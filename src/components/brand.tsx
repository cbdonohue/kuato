import Image from "next/image";
import Link from "next/link";

export function BrandMark({
  size,
  className,
}: {
  size: number;
  className?: string;
}) {
  return (
    <Image
      src="/kuato.png"
      alt=""
      width={size}
      height={size}
      className={className}
      preload
    />
  );
}

export function BrandLink({ size = 36 }: { size?: number }) {
  return (
    <Link
      href="/"
      className="flex items-center gap-2.5 text-foreground transition hover:text-foreground"
    >
      <BrandMark size={size} />
      <span className="text-sm font-semibold tracking-tight">Kuato</span>
    </Link>
  );
}
