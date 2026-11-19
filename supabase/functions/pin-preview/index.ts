// Recibe un link (Pinterest, Instagram, cualquier página) y guarda su imagen
// principal en Storage. Devuelve { path, title, enlace }.
import { createClient } from "npm:@supabase/supabase-js@2";

const cors = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

const UA =
  "Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.0 Mobile/15E148 Safari/604.1";

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...cors, "Content-Type": "application/json" },
  });
}

function urlSegura(raw: string): URL | null {
  try {
    const u = new URL(raw.trim());
    if (u.protocol !== "https:" && u.protocol !== "http:") return null;
    const h = u.hostname;
    if (h === "localhost" || /^(\d+\.){3}\d+$/.test(h) || h.endsWith(".local") || h.includes(":")) return null;
    return u;
  } catch {
    return null;
  }
}

function meta(html: string, prop: string): string | null {
  const re1 = new RegExp(`<meta[^>]+(?:property|name)=["']${prop}["'][^>]+content=["']([^"']+)["']`, "i");
  const re2 = new RegExp(`<meta[^>]+content=["']([^"']+)["'][^>]+(?:property|name)=["']${prop}["']`, "i");
  const m = html.match(re1) ?? html.match(re2);
  return m ? m[1].replace(/&amp;/g, "&") : null;
}

async function buscarImagen(url: URL): Promise<{ image: string | null; title: string | null; final: string }> {
  const res = await fetch(url, { headers: { "User-Agent": UA, "Accept-Language": "es" }, redirect: "follow" });
  const final = res.url || url.toString();
  const html = (await res.text()).slice(0, 1_500_000);
  let image = meta(html, "og:image") ?? meta(html, "twitter:image");
  let title = meta(html, "og:title") ?? meta(html, "og:description");

  // Pinterest a veces no trae og:image al servidor: usamos su oEmbed
  if (!image && /pinterest\./i.test(new URL(final).hostname)) {
    try {
      const o = await fetch(`https://www.pinterest.com/oembed.json?url=${encodeURIComponent(final)}`);
      if (o.ok) {
        const d = await o.json();
        image = d.thumbnail_url ?? null;
        title = title ?? d.title ?? null;
      }
    } catch { /* sin oEmbed */ }
  }
  if (image) image = new URL(image, final).toString();
  return { image, title, final };
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: cors });
  if (req.method !== "POST") return json({ error: "Método no permitido" }, 405);

  const auth = req.headers.get("Authorization") ?? "";
  const supaUrl = Deno.env.get("SUPABASE_URL")!;
  const usuario = createClient(supaUrl, Deno.env.get("SUPABASE_ANON_KEY")!, {
    global: { headers: { Authorization: auth } },
  });
  const { data: esMiembro } = await usuario.rpc("es_miembro");
  if (!esMiembro) return json({ error: "Sin acceso" }, 403);

  let body: { url?: string };
  try { body = await req.json(); } catch { return json({ error: "JSON inválido" }, 400); }
  const url = urlSegura(body.url ?? "");
  if (!url) return json({ error: "Link no válido" }, 400);

  try {
    const { image, title, final } = await buscarImagen(url);
    if (!image) return json({ error: "No encontré una imagen en ese link. Prueba subiendo una captura." }, 422);

    const img = await fetch(image, { headers: { "User-Agent": UA } });
    const tipo = img.headers.get("content-type") ?? "image/jpeg";
    if (!img.ok || !tipo.startsWith("image/")) return json({ error: "No pude descargar la imagen" }, 422);
    const bytes = new Uint8Array(await img.arrayBuffer());
    if (bytes.byteLength > 10_000_000) return json({ error: "La imagen es demasiado grande" }, 422);

    const ext = tipo.includes("png") ? "png" : tipo.includes("webp") ? "webp" : "jpg";
    const path = `ideas/${crypto.randomUUID()}.${ext}`;
    const admin = createClient(supaUrl, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);
    const { error } = await admin.storage.from("boda").upload(path, bytes, { contentType: tipo });
    if (error) return json({ error: "No pude guardar la imagen" }, 500);

    return json({ path, title, enlace: final });
  } catch (_e) {
    return json({ error: "No pude abrir ese link" }, 502);
  }
});
