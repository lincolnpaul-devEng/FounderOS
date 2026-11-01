import { Home6Console } from '@/components/Home6Console';

// Operator console — Example-6 design (approved 2026-08-23, "i like that
// design. publish it"). The layout lives in components/Home6Console.tsx and
// was also served at /design/home-6 until 2026-10-09 (archive/design-prototypes/).
export const dynamic = 'force-dynamic';

export default async function HomePage() {
  return <Home6Console />;
}
