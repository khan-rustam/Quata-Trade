import { headers } from "next/headers";
import { getJsonLd } from "@/lib/seo-engine";

/**
 * Render engine-supplied JSON-LD blocks for a given path.
 *
 * Fail-open: when the engine has nothing for this path (or is unreachable)
 * the component renders nothing — no markup, no boundary, no console noise.
 * Any static structured data the page already ships stays as the floor.
 *
 * Each block is escaped so a user-controlled string inside the JSON
 * (e.g. a trader display name containing `</script>`) cannot break out of
 * the script tag — `<` is the only character HTML cares about inside
 * <script>; `<` is its safe encoding.
 *
 * A `nonce` is read defensively from the per-request headers in case a strict
 * CSP is added later (QuataTrade currently sets only `frame-ancestors 'none'`,
 * so there is no nonce today and the attribute is simply omitted).
 */
export async function EngineJsonLd({ path }: { path: string }) {
  const blocks = await getJsonLd(path);
  if (!blocks || blocks.length === 0) return null;

  const nonce = (await headers()).get("x-nonce") ?? undefined;

  return (
    <>
      {blocks.map((block, i) => {
        const ldJson = JSON.stringify(block).replace(/</g, "\\u003c");
        return (
          <script
            key={i}
            type="application/ld+json"
            nonce={nonce}
            dangerouslySetInnerHTML={{ __html: ldJson }}
          />
        );
      })}
    </>
  );
}
