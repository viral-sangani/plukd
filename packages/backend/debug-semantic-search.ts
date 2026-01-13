import { createClient } from '@supabase/supabase-js'
import { generateQueryEmbedding } from './src/lib/ai/embeddings'
import { formatEmbeddingForPostgres } from './src/lib/ai/embeddings'

const SUPABASE_URL = process.env.SUPABASE_URL!
const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY!
const USER_ID = '1b4a1061-9c90-40e2-bd46-ba1bced7a644'

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY)

async function debugSemanticSearch() {
  console.log('🔍 Debugging Semantic Search for "movie"\n')

  // 1. Check if bookmarks have embeddings
  console.log('1️⃣ Checking bookmarks with embeddings...')
  const { data: bookmarksWithEmbeddings, error: embeddingsError } = await supabase
    .from('bookmarks')
    .select('id, title, url, blurb, embedding, source')
    .eq('user_id', USER_ID)
    .not('embedding', 'is', null)
    .order('created_at', { ascending: false })
    .limit(10)

  if (embeddingsError) {
    console.error('❌ Error fetching bookmarks:', embeddingsError)
    return
  }

  console.log(`✅ Found ${bookmarksWithEmbeddings?.length || 0} bookmarks with embeddings`)

  if (bookmarksWithEmbeddings && bookmarksWithEmbeddings.length > 0) {
    console.log('\nRecent bookmarks with embeddings:')
    bookmarksWithEmbeddings.forEach((bm, i) => {
      console.log(`  ${i + 1}. ${bm.title || 'Untitled'}`)
      console.log(`     Source: ${bm.source || 'unknown'}`)
      console.log(`     URL: ${bm.url}`)
      console.log(`     Has embedding: ${bm.embedding ? '✅' : '❌'}`)
      if (bm.blurb) {
        console.log(`     Blurb: ${bm.blurb.substring(0, 80)}...`)
      }
      console.log('')
    })
  }

  // 2. Check Instagram reels specifically
  console.log('\n2️⃣ Checking Instagram content...')
  const { data: instagramBookmarks, error: instaError } = await supabase
    .from('bookmarks')
    .select('id, title, url, blurb, summary, key_takeaways, embedding, source')
    .eq('user_id', USER_ID)
    .or('url.ilike.%instagram%,source.eq.instagram')
    .order('created_at', { ascending: false })
    .limit(5)

  if (instaError) {
    console.error('❌ Error fetching Instagram bookmarks:', instaError)
  } else {
    console.log(`✅ Found ${instagramBookmarks?.length || 0} Instagram bookmarks`)

    if (instagramBookmarks && instagramBookmarks.length > 0) {
      console.log('\nInstagram bookmarks:')
      instagramBookmarks.forEach((bm, i) => {
        console.log(`  ${i + 1}. ${bm.title || 'Untitled'}`)
        console.log(`     URL: ${bm.url}`)
        console.log(`     Has embedding: ${bm.embedding ? '✅' : '❌'}`)
        if (bm.blurb) {
          console.log(`     Blurb: ${bm.blurb}`)
        }
        if (bm.summary) {
          console.log(`     Summary: ${bm.summary.substring(0, 150)}...`)
        }
        if (bm.key_takeaways && bm.key_takeaways.length > 0) {
          console.log(`     Key takeaways: ${bm.key_takeaways.slice(0, 3).join(', ')}`)
        }
        console.log('')
      })
    }
  }

  // 3. Generate embedding for "movie" and test search
  console.log('\n3️⃣ Testing semantic search for "movie"...')
  try {
    const queryEmbedding = await generateQueryEmbedding('movie')
    console.log(`✅ Generated embedding for "movie" (${queryEmbedding.length} dimensions)`)

    const embeddingLiteral = formatEmbeddingForPostgres(queryEmbedding)

    // Try with different thresholds
    const thresholds = [0.1, 0.3, 0.5, 0.7, 0.8]

    for (const threshold of thresholds) {
      const { data: results, error: searchError } = await supabase.rpc(
        'search_bookmarks_semantic',
        {
          query_embedding: embeddingLiteral,
          user_id_param: USER_ID,
          match_threshold: threshold,
          match_count: 25,
          include_archived: false,
        }
      )

      if (searchError) {
        console.error(`  ❌ Threshold ${threshold}: RPC error:`, searchError)
      } else {
        console.log(`  Threshold ${threshold}: Found ${results?.length || 0} results`)
        if (results && results.length > 0) {
          console.log(`    Top result: "${results[0].title}" (similarity: ${results[0].similarity?.toFixed(3)})`)
        }
      }
    }
  } catch (error) {
    console.error('❌ Error generating embedding:', error)
  }

  // 4. Check for bookmarks containing "movie" in text
  console.log('\n4️⃣ Checking for "movie" in bookmark text...')
  const { data: movieBookmarks, error: movieError } = await supabase
    .from('bookmarks')
    .select('id, title, url, blurb, summary, embedding')
    .eq('user_id', USER_ID)
    .or('title.ilike.%movie%,blurb.ilike.%movie%,summary.ilike.%movie%')
    .limit(5)

  if (movieError) {
    console.error('❌ Error:', movieError)
  } else {
    console.log(`✅ Found ${movieBookmarks?.length || 0} bookmarks with "movie" in text`)
    if (movieBookmarks && movieBookmarks.length > 0) {
      movieBookmarks.forEach((bm, i) => {
        console.log(`  ${i + 1}. ${bm.title || 'Untitled'}`)
        console.log(`     URL: ${bm.url}`)
        console.log(`     Has embedding: ${bm.embedding ? '✅' : '❌'}`)
        console.log('')
      })
    }
  }

  console.log('\n✨ Debug complete!')
}

debugSemanticSearch().catch(console.error)
