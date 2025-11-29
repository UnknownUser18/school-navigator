import { Component, computed, signal } from '@angular/core';
import { Day, DayName, Timetable } from "@services/timetable";
import { Chip } from "@modules/chip/chip";
import { FaIconComponent } from "@fortawesome/angular-fontawesome";
import { faArrowRight, faEdit, faTrash } from "@fortawesome/free-solid-svg-icons";
import { MatRipple } from "@angular/material/core";
import { Router, RouterLink } from "@angular/router";
import { ConvertTimePipe } from "@app/pipe/convert-time-pipe";

@Component({
  selector    : 'app-timetable',
  imports : [
    Chip,
    FaIconComponent,
    MatRipple,
    RouterLink,
    ConvertTimePipe
  ],
  templateUrl : './timetable.component.html',
  styleUrl    : './timetable.component.scss',
})
export class TimetableComponent {
  protected readonly currentDay = signal<DayName>('Poniedziałek');
  protected readonly timetable = signal<Day[] | null>(null);

  protected readonly faArrowRight = faArrowRight;
  protected readonly faEdit = faEdit;
  protected readonly faTrash = faTrash;

  protected readonly shownDay = computed(() => {
    const tt = this.timetable();
    if (!tt)
      return null;

    return tt.filter(day => day.dayName === this.currentDay())[0] || null;
  });

  protected readonly DayNames : DayName[] = ['Poniedziałek', 'Wtorek', 'Środa', 'Czwartek', 'Piątek'];

  constructor(private timetableS : Timetable, private router : Router) {
    this.timetable.set(this.timetableS.getTimetable);
  }

  protected deleteTimetable() {
    this.timetableS.setTimetable = null;
    this.timetable.set(null);
  }

  protected navigateToRoom(roomNumber : string) {
    this.router.navigate(['/map'], { queryParams : { room : roomNumber } }).then();
  }
}
