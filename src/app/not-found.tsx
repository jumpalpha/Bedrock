import Link from "next/link";
export default function NotFound() {
  return (
    <div className="mx-auto max-w-xl px-6 py-24 text-center">
      <div className="tex tex-bedrock mx-auto size-24 border-[3px] border-black" />
      <h1 className="pixel-title mt-6 text-4xl">You hit bedrock.</h1>
      <p className="mt-3 font-semibold text-muted">There&apos;s nothing to mine at this address.</p>
      <Link href="/" className="btn-block btn-grass mt-6">Back to the World Map</Link>
    </div>
  );
}
