import { Component, signal } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { TabItem, TabsComponent } from './tabs.component';

@Component({
  imports: [TabsComponent],
  template: `<app-tabs [tabs]="tabs" [(active)]="active" label="Sections" />`,
})
class HostComponent {
  tabs: TabItem[] = [
    { id: 'a', label: 'Cours' },
    { id: 'b', label: 'Crédits', count: 2 },
    { id: 'c', label: 'Sessions' },
  ];
  active = signal('a');
}

describe('TabsComponent', () => {
  function setup() {
    const fixture = TestBed.createComponent(HostComponent);
    fixture.detectChanges();
    const el = fixture.nativeElement as HTMLElement;
    const buttons = () => [...el.querySelectorAll<HTMLButtonElement>('[role=tab]')];
    return { fixture, el, buttons };
  }

  it('expose un groupe d’onglets accessible', () => {
    const { el, buttons } = setup();
    expect(el.querySelector('[role=tablist]')?.getAttribute('aria-label')).toBe('Sections');
    expect(buttons().length).toBe(3);
    expect(buttons()[0].getAttribute('aria-selected')).toBe('true');
    expect(buttons()[0].tabIndex).toBe(0);
    expect(buttons()[1].tabIndex).toBe(-1);
    expect(buttons()[1].textContent).toContain('2');
  });

  it('se pilote au clavier (flèches, début, fin)', () => {
    const { fixture, buttons } = setup();
    const press = (key: string) => {
      buttons()[0].dispatchEvent(new KeyboardEvent('keydown', { key, bubbles: true }));
      fixture.detectChanges();
    };
    press('ArrowRight');
    expect(fixture.componentInstance.active()).toBe('b');
    press('End');
    expect(fixture.componentInstance.active()).toBe('c');
    press('Home');
    expect(fixture.componentInstance.active()).toBe('a');
    press('ArrowLeft');
    expect(fixture.componentInstance.active()).toBe('c');
  });

  it('change d’onglet au clic', () => {
    const { fixture, buttons } = setup();
    buttons()[2].click();
    fixture.detectChanges();
    expect(fixture.componentInstance.active()).toBe('c');
    expect(buttons()[2].getAttribute('aria-selected')).toBe('true');
  });
});
