import { ChangeDetectionStrategy, Component, computed, input } from '@angular/core';

/**
 * Avatar en forme d'arche (charte Sidi Bou Saïd) : la photo de profil si elle existe,
 * sinon les initiales. Le nom de transition permet l'animation d'une page à l'autre.
 */
@Component({
  selector: 'app-avatar',
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: { style: 'display:contents' },
  template: `<span
    class="arc"
    aria-hidden="true"
    [style.width.px]="size()"
    [style.height.px]="size() * 1.19"
    [style.font-size.px]="size() * 0.32"
    [style.view-transition-name]="transitionName()"
  >
    @if (photo(); as src) {
      <img
        [src]="src"
        alt=""
        [width]="size()"
        [height]="size() * 1.19"
        loading="lazy"
        decoding="async"
      />
    } @else {
      {{ initials() }}
    }
  </span>`,
  styles: `
    .arc {
      overflow: hidden;
    }
    img {
      width: 100%;
      height: 100%;
      object-fit: cover;
      display: block;
    }
  `,
})
export class AvatarComponent {
  readonly name = input.required<string>();
  readonly size = input(64);
  readonly photo = input<string | null | undefined>(null);
  readonly transitionName = input<string | null>(null);
  protected readonly initials = computed(() =>
    this.name()
      .split(/\s+/)
      .filter(Boolean)
      .slice(0, 2)
      .map((w) => w[0])
      .join('')
      .toUpperCase(),
  );
}
