export default function AuthLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-screen flex items-center justify-center bg-background px-4">
      <div className="w-full max-w-sm">
        <div className="text-center mb-8">
          <h1 className="font-display text-4xl text-primary tracking-wide">Sally</h1>
          <p className="text-sm text-muted-foreground mt-1">Your fragrance collection</p>
        </div>
        {children}
      </div>
    </div>
  );
}
