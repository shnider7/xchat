// Fundo de "cacos" do painel inteiro (claro e escuro), igual ao da tela de login
const F: [string, string][] = [
  ["polygon(0 0,40% 0,24% 44%,0 28%)", "var(--c1)"], ["polygon(40% 0,100% 0,100% 22%,58% 30%,24% 44%)", "var(--c2)"],
  ["polygon(0 28%,24% 44%,12% 100%,0 100%)", "var(--c3)"], ["polygon(24% 44%,58% 30%,70% 72%,38% 100%,12% 100%)", "var(--c4)"],
  ["polygon(58% 30%,100% 22%,100% 70%,70% 72%)", "var(--c5)"], ["polygon(70% 72%,100% 70%,100% 100%,38% 100%)", "var(--c6)"],
  ["polygon(24% 44%,58% 30%,58.4% 30.7%,24.4% 44.7%)", "var(--sliver)"], ["polygon(58% 30%,70% 72%,69.6% 72.3%,57.6% 30.4%)", "var(--sliver)"],
  ["polygon(24% 44%,12% 100%,12.4% 100%,24.4% 44.6%)", "var(--sliver)"],
];
export default function Backdrop() {
  return (
    <div aria-hidden className="pointer-events-none fixed inset-0 -z-10 overflow-hidden" style={{ background: "var(--bg-base)" }}>
      {F.map(([clip, bg], i) => <div key={i} className="absolute inset-0" style={{ clipPath: clip, background: bg }} />)}
      <div className="absolute inset-0" style={{ background: "radial-gradient(55% 50% at 50% 55%, rgba(249,115,22,.10), transparent 70%)" }} />
    </div>
  );
}
