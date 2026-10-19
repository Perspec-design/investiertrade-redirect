import { Hono } from 'hono'
import { bearerAuth } from 'hono/bearer-auth'

type Bindings = {
  DB: D1Database
  ADMIN_TOKEN: string
}

const app = new Hono<{ Bindings: Bindings }>()

// --- Public redirect endpoint ---
app.get('/:slug', async (c) => {
  const slug = c.req.param('slug')
  const row = await c.env.DB
    .prepare('SELECT target_url FROM links WHERE slug = ?')
    .bind(slug)
    .first<{ target_url: string }>()

  if (!row) return c.notFound()

  // Increment counter without blocking the redirect
  c.executionCtx.waitUntil(
    c.env.DB.prepare('UPDATE links SET clicks = clicks + 1 WHERE slug = ?')
      .bind(slug).run()
  )

  return c.redirect(row.target_url, 302)
})

// --- Admin API (token-protected) ---
app.use('/admin/*', async (c, next) =>
  bearerAuth({ verifyToken: async (token, ctx) => token === ctx.env.ADMIN_TOKEN })(c, next)
)

app.post('/admin/links', async (c) => {
  const { slug, target_url } = await c.req.json()

  const url = new URL(target_url) // throws on garbage
  if (!['http:', 'https:'].includes(url.protocol)) {
    return c.json({ error: 'Only http/https targets allowed' }, 400)
  }
  if (!/^[a-z0-9-]{2,64}$/.test(slug)) {
    return c.json({ error: 'Invalid slug' }, 400)
  }

  await c.env.DB
    .prepare(`INSERT INTO links (slug, target_url) VALUES (?, ?)
              ON CONFLICT(slug) DO UPDATE SET target_url = excluded.target_url`)
    .bind(slug, url.toString())
    .run()

  return c.json({ ok: true, short: `https://www.investiertrade.com/${slug}` })
})

app.get('/admin/stats/:slug', async (c) => {
  const row = await c.env.DB
    .prepare('SELECT slug, target_url, clicks FROM links WHERE slug = ?')
    .bind(c.req.param('slug'))
    .first()
  return row ? c.json(row) : c.notFound()
})

export default app
