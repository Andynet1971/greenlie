import Link from 'next/link';

export default function NotFound() {
  return (
    <>
      <h1>Not found</h1>
      <p>There is nothing here.</p>
      <p>
        <Link href="/">Back to the overview</Link>
      </p>
    </>
  );
}
