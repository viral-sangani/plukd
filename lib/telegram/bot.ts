import { Bot, Context } from 'grammy'
import { createClient } from '@supabase/supabase-js'
import type {
  Database,
  Tag,
  Category,
  ContentSource,
  ProcessingStatus,
} from '@/types/database'
import { extractUrls, detectSource, generateCode } from '@/lib/utils'
import { processBookmark } from '@/lib/processing/pipeline'

// Type aliases for table insert types
type TelegramLinkCodeInsert = Database['public']['Tables']['telegram_link_codes']['Insert']
type BookmarkInsert = Database['public']['Tables']['bookmarks']['Insert']

/**
 * Create a Supabase admin client for use outside Next.js request context
 * Uses service role key to bypass RLS
 */
function createAdminClient() {
  return createClient<Database>(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  )
}

/**
 * Create a Grammy Bot instance using the Telegram bot token from environment
 */
export function createBot(): Bot {
  const token = process.env.TELEGRAM_BOT_TOKEN
  if (!token) {
    throw new Error('TELEGRAM_BOT_TOKEN environment variable is not set')
  }
  return new Bot(token)
}

/**
 * Set up all bot handlers for commands and messages
 */
export function setupBotHandlers(bot: Bot): void {
  // Handle /start command
  bot.command('start', handleStartCommand)

  // Handle text messages (for saving URLs)
  bot.on('message:text', handleTextMessage)
}

/**
 * Handle the /start command
 * - If user is already linked, inform them
 * - If not linked, generate a link code
 */
async function handleStartCommand(ctx: Context): Promise<void> {
  try {
    const chatId = ctx.chat?.id?.toString()
    const username = ctx.from?.username

    if (!chatId) {
      await ctx.reply('Unable to identify your chat. Please try again.')
      return
    }

    const supabase = createAdminClient()

    // Check if user is already linked
    const { data: existingUser, error: userError } = await supabase
      .from('users')
      .select('id')
      .eq('telegram_chat_id', chatId)
      .single()

    if (userError && userError.code !== 'PGRST116') {
      // PGRST116 is "no rows found" which is expected for new users
      console.error('Error checking user:', userError)
      await ctx.reply('Something went wrong. Please try again later.')
      return
    }

    if (existingUser) {
      await ctx.reply("You're already connected to Plukd! Send me any URL to save it.")
      return
    }

    // Generate a link code for new users
    const code = generateCode(6)
    const expiresAt = new Date(Date.now() + 10 * 60 * 1000).toISOString() // 10 minutes from now

    // Note: telegram_username column requires migration 004 to be applied
    // For now, just store the basic info and set username on user during link
    const linkCodeData: TelegramLinkCodeInsert = {
      code,
      telegram_chat_id: chatId,
      expires_at: expiresAt,
    }

    const { error: insertError } = await supabase
      .from('telegram_link_codes')
      .insert(linkCodeData as never)

    if (insertError) {
      console.error('Error inserting link code:', insertError)
      await ctx.reply('Something went wrong generating your code. Please try again.')
      return
    }

    const welcomeMessage = `Welcome to Plukd!

To connect your account, enter this code in the Plukd app:

${code}

This code expires in 10 minutes.

${username ? `Your Telegram username: @${username}` : ''}`

    await ctx.reply(welcomeMessage)
  } catch (error) {
    console.error('Error in /start command:', error)
    await ctx.reply('Something went wrong. Please try again later.')
  }
}

/**
 * Handle incoming text messages
 * - Extract URLs from the message
 * - Save bookmarks for linked users
 */
async function handleTextMessage(ctx: Context): Promise<void> {
  try {
    const chatId = ctx.chat?.id?.toString()
    const messageText = ctx.message?.text

    if (!chatId || !messageText) {
      return
    }

    const supabase = createAdminClient()

    // Look up user by telegram_chat_id
    const { data: user, error: userError } = await supabase
      .from('users')
      .select('id')
      .eq('telegram_chat_id', chatId)
      .single()

    if (userError || !user) {
      await ctx.reply('Please link your account first. Send /start to get a code.')
      return
    }

    // Extract URLs from the message
    const urls = extractUrls(messageText)

    if (urls.length === 0) {
      await ctx.reply('Send me a link to save it!')
      return
    }

    // Save each URL as a bookmark
    const bookmarksToInsert: BookmarkInsert[] = urls.map((url) => ({
      user_id: (user as { id: string }).id,
      url,
      source: detectSource(url) as ContentSource,
      title: url, // Use URL as placeholder title
      blurb: '',
      summary: '',
      category: 'news-updates' as Category,
      tags: [] as Tag[],
      processing_status: 'pending' as ProcessingStatus,
    }))

    const { data: insertedBookmarksData, error: insertError } = await supabase
      .from('bookmarks')
      .insert(bookmarksToInsert as never)
      .select('id, url')

    if (insertError) {
      console.error('Error inserting bookmarks:', insertError)
      await ctx.reply('Failed to save. Please try again.')
      return
    }

    // Reply immediately - don't wait for processing
    const replyMessage = urls.length === 1 ? 'Saved' : `Saved ${urls.length} bookmarks`
    await ctx.reply(replyMessage)

    // Trigger processing for each bookmark in the background (don't await)
    const insertedBookmarks = (insertedBookmarksData || []) as Array<{ id: string; url: string }>
    for (const bookmark of insertedBookmarks) {
      processBookmark(bookmark.id, bookmark.url).catch((err) => {
        console.error(`Failed to process bookmark ${bookmark.id}:`, err)
      })
    }
  } catch (error) {
    console.error('Error handling message:', error)
    await ctx.reply('Something went wrong. Please try again later.')
  }
}
