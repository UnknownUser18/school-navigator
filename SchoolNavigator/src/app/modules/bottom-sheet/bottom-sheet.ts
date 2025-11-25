import { Component, inject } from '@angular/core';
import { FaIconComponent } from "@fortawesome/angular-fontawesome";
import { faArrowLeft, faArrowRight, faArrowUp, faFlagCheckered, faStairs } from "@fortawesome/free-solid-svg-icons";
import { MAT_BOTTOM_SHEET_DATA, MatBottomSheetRef } from "@angular/material/bottom-sheet";
import { Maneuver } from "@services/navigation";

@Component({
  selector    : 'app-bottom-sheet',
  imports     : [
    FaIconComponent
  ],
  templateUrl : './bottom-sheet.html',
  styleUrl    : './bottom-sheet.scss',
})
export class BottomSheet {
  protected readonly faArrowLeft = faArrowLeft;
  protected readonly faFlagCheckered = faFlagCheckered;
  protected readonly faArrowRight = faArrowRight;
  protected readonly faArrowUp = faArrowUp;
  protected readonly faStairs = faStairs;


  public data = inject(MAT_BOTTOM_SHEET_DATA) as { maneuvers : Maneuver[] };

  constructor(private bottomSheetRef : MatBottomSheetRef<BottomSheet>) {
  }
}
