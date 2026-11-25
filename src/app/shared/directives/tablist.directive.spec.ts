import { Component, signal } from '@angular/core';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { TablistDirective } from './tablist.directive';

@Component({
  imports: [TablistDirective],
  template: `
    <div role="tablist" aria-label="Prova" [selectOnFocus]="follow()">
      @for (name of names; track name) {
      <button type="button" role="tab" [attr.aria-selected]="selected() === name" (click)="selected.set(name)">
        {{ name }}
      </button>
      }
    </div>
  `,
})
class Host {
  readonly names = ['uno', 'due', 'tre'];
  readonly selected = signal('due');
  readonly follow = signal(false);
}

describe('TablistDirective', () => {
  let fixture: ComponentFixture<Host>;
  let tabs: HTMLButtonElement[];

  const press = (tab: HTMLElement, key: string) =>
    tab.dispatchEvent(new KeyboardEvent('keydown', { key, bubbles: true, cancelable: true }));
  const stops = () => tabs.map((tab) => tab.tabIndex);

  beforeEach(async () => {
    fixture = TestBed.createComponent(Host);
    document.body.append(fixture.nativeElement);
    fixture.detectChanges();
    await fixture.whenStable();
    tabs = [...fixture.nativeElement.querySelectorAll('[role="tab"]')];
  });

  afterEach(() => fixture.nativeElement.remove());

  it('leaves one tab stop, on the selected tab', () => {
    expect(stops()).toEqual([-1, 0, -1]);
  });

  it('moves the focus with the arrows, round the ends, and with Home and End', () => {
    tabs[1].focus();
    press(tabs[1], 'ArrowRight');
    expect(document.activeElement).toBe(tabs[2]);
    press(tabs[2], 'ArrowRight');
    expect(document.activeElement).toBe(tabs[0]);
    press(tabs[0], 'ArrowLeft');
    expect(document.activeElement).toBe(tabs[2]);
    press(tabs[2], 'Home');
    expect(document.activeElement).toBe(tabs[0]);
    press(tabs[0], 'End');
    expect(document.activeElement).toBe(tabs[2]);
    expect(stops()).toEqual([-1, -1, 0]);
  });

  it('only moves the focus by default: selecting is Enter or Space, a click', () => {
    tabs[1].focus();
    press(tabs[1], 'ArrowRight');
    expect(fixture.componentInstance.selected()).toBe('due');
  });

  it('selects the tab it moves to with selectOnFocus', async () => {
    fixture.componentInstance.follow.set(true);
    fixture.detectChanges();
    tabs[1].focus();
    press(tabs[1], 'ArrowLeft');
    expect(fixture.componentInstance.selected()).toBe('uno');
  });

  it('moves the tab stop when the selection changes', async () => {
    fixture.componentInstance.selected.set('tre');
    fixture.detectChanges();
    await new Promise((resolve) => setTimeout(resolve));
    expect(stops()).toEqual([-1, -1, 0]);
  });
});
