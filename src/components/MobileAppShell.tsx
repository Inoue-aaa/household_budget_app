export function MobileAppShell({
  children
}: Readonly<{
  children: React.ReactNode;
}>) {
  return <main className="app-frame">{children}</main>;
}
