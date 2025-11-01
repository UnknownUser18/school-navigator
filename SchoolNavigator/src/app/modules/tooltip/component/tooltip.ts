import { Component, inject, signal, TemplateRef, viewChild, ViewContainerRef } from '@angular/core';
import { ConnectedPosition, FlexibleConnectedPositionStrategy, Overlay, OverlayRef } from "@angular/cdk/overlay";
import { TemplatePortal } from "@angular/cdk/portal";
import { TooltipRegistry } from "@modules/tooltip/tooltip-registry";

@Component({
  selector    : 'tooltip',
  imports     : [],
  templateUrl : './tooltip.html',
  styleUrl    : './tooltip.scss',
})
export class Tooltip {
  private tooltipRegistry = inject(TooltipRegistry);

  private readonly positions : ConnectedPosition[] = [
    {
      originX  : 'center',
      originY  : 'bottom',
      overlayX : 'center',
      overlayY : 'top',
      offsetY  : 8,
    },
    {
      originX  : 'center',
      originY  : 'top',
      overlayX : 'center',
      overlayY : 'bottom',
      offsetY  : -8,
    }
  ];

  private overlayRef! : OverlayRef;
  private hideTimeout : any;
  private tooltip = viewChild.required<TemplateRef<any>>('tooltip');

  protected isVisible = signal(false);

  constructor(
    private overlay : Overlay,
    private vcr : ViewContainerRef,
  ) {}

  private destroy() {
    this.overlayRef?.dispose();
  }

  private forceHide() {
    this.clearHideTimeout();
    this.isVisible.set(false);
    this.overlayRef?.detach();
    this.destroy();
    this.tooltipRegistry.registerTooltipClose();
  }

  private createTooltip(positionStrategy : FlexibleConnectedPositionStrategy) {
    if (this.isVisible()) {
      this.forceHide();
    } else if (this.tooltipRegistry.isTooltipOpen()) {
      this.hide();
      this.tooltipRegistry.registerTooltipClose();
    }

    this.overlayRef = this.overlay.create({
      hasBackdrop    : true,
      backdropClass  : 'cdk-overlay-transparent-backdrop',
      scrollStrategy : this.overlay.scrollStrategies.reposition(),
      positionStrategy
    });

    this.overlayRef.backdropClick().subscribe(() => this.hide());

    const portal = new TemplatePortal(this.tooltip(), this.vcr);
    this.overlayRef.attach(portal);
    this.isVisible.set(true);
    this.tooltipRegistry.registerTooltipOpen();
  }

  protected clearHideTimeout() {
    if (!this.hideTimeout) return;

    clearTimeout(this.hideTimeout);
    this.hideTimeout = null;
  }

  public createInfoTooltip(event : MouseEvent | TouchEvent) {
    if (this.isVisible()) return;

    const positionStrategy = this.overlay
    .position()
    .flexibleConnectedTo({
      x : 'clientX' in event ? event.clientX : event.touches[0].clientX,
      y : 'clientY' in event ? event.clientY : event.touches[0].clientY
    })
    .withPositions(this.positions)
    .withPush(true);

    this.createTooltip(positionStrategy);
  }

  public hide() {
    this.clearHideTimeout();
    this.hideTimeout = setTimeout(() => {
      this.isVisible.set(false);
      setTimeout(() => {
        this.overlayRef?.detach();
        this.destroy();
        this.tooltipRegistry.registerTooltipClose();
      }, 200)
    }, 150);
  }

}
