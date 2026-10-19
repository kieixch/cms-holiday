/**
 * Renderer tag `<script type="application/ld+json">` untuk structured data.
 *
 * `</` di-escape jadi `<\/` supaya konten tidak bisa menutup tag script
 * (JSON.stringify aman untuk JSON-nya sendiri, tapi tidak untuk HTML
 * embedding). Klien tidak membaca skrip ini — mesin pencari yang membaca.
 */
export function JsonLd({ data }: { data: object }) {
  return (
    <script
      type="application/ld+json"
      dangerouslySetInnerHTML={{ __html: JSON.stringify(data).replace(/</g, "\\u003c") }}
    />
  );
}
