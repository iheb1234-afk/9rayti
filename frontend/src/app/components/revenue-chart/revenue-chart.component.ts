import { ChangeDetectionStrategy, Component, computed, input, signal } from '@angular/core';
import { TranslocoPipe } from '@jsverse/transloco';
import { RevenueWeek } from '../../core/api/models';
import { DtPipe } from '../../pipes/dt.pipe';
import { WhenPipe } from '../../pipes/when.pipe';

/**
 * Graphique des revenus par semaine (versés / en attente), en SVG pur : pas de bibliothèque
 * de graphiques à charger. Les barres poussent à l'affichage ; un tableau caché sert les
 * lecteurs d'écran.
 */
@Component({
  selector: 'app-revenue-chart',
  imports: [TranslocoPipe, DtPipe, WhenPipe],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `<figure class="chart">
    <svg [attr.viewBox]="'0 0 ' + W + ' ' + H" role="img" [attr.aria-label]="'revenue.chartLabel' | transloco" preserveAspectRatio="none">
      @for (g of grid(); track g.y) {
        <line class="grid" x1="0" [attr.x2]="W" [attr.y1]="g.y" [attr.y2]="g.y" />
      }
      @for (b of bars(); track b.i) {
        <g class="col" (pointerenter)="hover.set(b.i)" (pointerleave)="hover.set(-1)" [class.hot]="hover() === b.i">
          <rect class="hit" [attr.x]="b.x - 6" y="0" [attr.width]="b.w + 12" [attr.height]="H" />
          <rect class="paid" [attr.x]="b.x" [attr.y]="b.yPaid" [attr.width]="b.w" [attr.height]="b.hPaid" rx="5" [style.animation-delay.ms]="b.i * 45" />
          <rect class="pend" [attr.x]="b.x" [attr.y]="b.yPend" [attr.width]="b.w" [attr.height]="b.hPend" rx="5" [style.animation-delay.ms]="b.i * 45 + 120" />
        </g>
      }
    </svg>
    <div class="axis">
      @for (b of bars(); track b.i) {
        <span [class.show]="b.i % 2 === 1 || b.i === bars().length - 1">{{ b.week.weekStart | when: 'day' }}</span>
      }
    </div>
    @if (hovered(); as h) {
      <div class="tip" [style.inset-inline-start.%]="h.pct">
        <b>{{ h.week.weekStart | when: 'day' }}</b>
        <span>{{ 'revenue.paid' | transloco }} : {{ h.week.paidMillimes | dt }}</span>
        <span>{{ 'revenue.pending' | transloco }} : {{ h.week.pendingMillimes | dt }}</span>
        <span>{{ 'revenue.courses' | transloco: { n: h.week.courses } }}</span>
      </div>
    }
    <figcaption class="legend small">
      <span><i class="lp"></i>{{ 'revenue.paid' | transloco }}</span><span><i class="lw"></i>{{ 'revenue.pending' | transloco }}</span>
    </figcaption>
    <table class="sr-only">
      <caption>{{ 'revenue.chartLabel' | transloco }}</caption>
      <tr><th>{{ 'revenue.week' | transloco }}</th><th>{{ 'revenue.paid' | transloco }}</th><th>{{ 'revenue.pending' | transloco }}</th></tr>
      @for (w of weeks(); track w.weekStart) {
        <tr><td>{{ w.weekStart | when: 'day' }}</td><td>{{ w.paidMillimes | dt }}</td><td>{{ w.pendingMillimes | dt }}</td></tr>
      }
    </table>
  </figure>`,
  styles: `
    .chart { position: relative; margin: 0; }
    svg { width: 100%; height: 220px; display: block; overflow: visible; }
    .grid { stroke: var(--trait); stroke-dasharray: 3 5; }
    .paid { fill: var(--bleu); transform-box: fill-box; transform-origin: bottom; animation: grow 0.9s cubic-bezier(0.22, 1, 0.36, 1) both; }
    .pend { fill: var(--soleil); transform-box: fill-box; transform-origin: bottom; animation: grow 0.9s cubic-bezier(0.22, 1, 0.36, 1) both; }
    .hit { fill: transparent; }
    .col.hot .paid, .col.hot .pend { filter: brightness(1.12); }
    .axis { display: flex; justify-content: space-between; font-size: 11.5px; color: var(--gris); margin-top: 6px; }
    .axis span { flex: 1; text-align: center; visibility: hidden; white-space: nowrap; }
    .axis span.show { visibility: visible; }
    .tip { position: absolute; top: 6px; transform: translateX(-50%); background: var(--nuit); color: #fff; border-radius: 10px; padding: 8px 10px;
      font-size: 12.5px; display: flex; flex-direction: column; gap: 2px; pointer-events: none; box-shadow: 0 10px 24px rgba(11, 60, 120, 0.25); white-space: nowrap; }
    :host-context([dir='rtl']) .tip { transform: translateX(50%); }
    .legend { display: flex; gap: 16px; margin-top: 10px; color: var(--gris); }
    .legend i { display: inline-block; width: 10px; height: 10px; border-radius: 3px; margin-inline-end: 6px; vertical-align: -1px; }
    .lp { background: var(--bleu); } .lw { background: var(--soleil); }
    @keyframes grow { from { transform: scaleY(0); } }
  `,
})
export class RevenueChartComponent {
  readonly weeks = input.required<RevenueWeek[]>();
  protected readonly W = 600;
  protected readonly H = 200;
  protected readonly hover = signal(-1);

  private readonly max = computed(() => Math.max(10_000, ...this.weeks().map((w) => w.paidMillimes + w.pendingMillimes)) * 1.15);

  protected readonly bars = computed(() => {
    const n = this.weeks().length || 1;
    const slot = this.W / n;
    const w = Math.min(32, slot * 0.6);
    return this.weeks().map((week, i) => {
      const hPaid = (week.paidMillimes / this.max()) * this.H;
      const hPend = (week.pendingMillimes / this.max()) * this.H;
      const x = i * slot + (slot - w) / 2;
      return { i, week, x, w, hPaid, hPend, yPaid: this.H - hPaid, yPend: this.H - hPaid - hPend, pct: ((i + 0.5) / n) * 100 };
    });
  });

  protected readonly grid = computed(() => [0.25, 0.5, 0.75, 1].map((f) => ({ y: this.H - f * this.H })));
  protected readonly hovered = computed(() => this.bars()[this.hover()] ?? null);
}
