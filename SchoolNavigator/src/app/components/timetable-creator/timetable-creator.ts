import { Component, signal } from '@angular/core';
import { FormControl, FormGroup, ReactiveFormsModule } from "@angular/forms";
import { Day, DayName, Lesson, Timetable } from "@services/timetable";
import { Dropdown } from "@modules/dropdown/dropdown";
import { MapService, Room } from "@services/map.service";
import { Chip } from "@modules/chip/chip";
import { FaIconComponent } from "@fortawesome/angular-fontawesome";
import { faSave, faTrash } from "@fortawesome/free-solid-svg-icons";
import { Router } from "@angular/router";
import { MatRipple } from "@angular/material/core";

@Component({
  selector    : 'app-timetable-creator',
  imports     : [
    ReactiveFormsModule,
    Dropdown,
    Chip,
    FaIconComponent,
    MatRipple
  ],
  templateUrl : './timetable-creator.html',
  styleUrl    : './timetable-creator.scss',
})
export class TimetableCreator {
  private readonly days = signal<Day[] | null>(null);

  protected readonly currentDay = signal<DayName>('Poniedziałek')
  protected readonly rooms = signal<Room[] | null>(null);

  protected readonly DayNames = ['Poniedziałek', 'Wtorek', 'Środa', 'Czwartek', 'Piątek'] as DayName[];
  protected lessonsArray = Array.from({ length : 10 }, (_, i) => i + 1);

  protected readonly faSave = faSave;
  protected readonly faTrash = faTrash;

  protected dayForm = new FormGroup(
    Object.fromEntries(
      Array.from({ length : 10 }, (_, i) => [
        `lesson${ i + 1 }`,
        new FormGroup({
          subjectName : new FormControl<string>(''),
          teacherName : new FormControl<string>(''),
          roomNumber  : new FormControl<string>(''),
          startTime   : new FormControl<string>('08:00'),
          endTime     : new FormControl<string>('08:45'),
        }),
      ])
    )
  );

  constructor(private mapS : MapService, private timetableS : Timetable, private router : Router) {
    const points = this.mapS.getAllCachedPoints;
    this.rooms.set(points.filter((p) => 'room_number' in p));

    const existingTimetable = this.timetableS.getTimetable;
    if (existingTimetable) {
      this.days.set(existingTimetable);
      const firstDay = existingTimetable[0];

      const day = firstDay.dayName;
      this.currentDay.set(day);

      this.dayForm.patchValue({
        ...Object.fromEntries(firstDay.lessons.map((lesson, index) => [
          `lesson${ index + 1 }`,
          {
            subjectName : lesson.subjectName,
            teacherName : lesson.teacherName,
            roomNumber  : lesson.roomNumber,
            startTime   : new Date(lesson.startTime).toTimeString().substring(0, 5),
            endTime     : new Date(lesson.endTime).toTimeString().substring(0, 5),
          }
        ]))
      });
    }
  }

  private resetForm() {
    this.dayForm.reset({
      ...Object.fromEntries(
        this.lessonsArray.map(lessonNumber => [
          `lesson${ lessonNumber }`,
          {
            subjectName : '',
            teacherName : '',
            roomNumber  : '',
            startTime   : '08:00',
            endTime     : '08:45',
          }
        ])
      )
    });
  }

  protected getTime(lesson : number) {
    const lessonFormGroup = this.dayForm.get(`lesson${ lesson }`) as FormGroup;
    const startTime = lessonFormGroup.get('startTime')?.value;
    const endTime = lessonFormGroup.get('endTime')?.value;

    return `${ startTime } - ${ endTime }`;
  }

  protected selectDay(day : DayName) {
    const lessonsValue = this.dayForm.value;
    const lessons = this.lessonsArray.map((lessonNumber) => {
      const lessonGroup = lessonsValue[`lesson${ lessonNumber }`];
      return new Lesson(
        lessonGroup?.subjectName ?? '',
        lessonGroup?.teacherName ?? '',
        lessonGroup?.roomNumber ?? '',
        new Date(`1970-01-01T${ lessonGroup?.startTime ?? '08:00' }:00`),
        new Date(`1970-01-01T${ lessonGroup?.endTime ?? '08:45' }:00`)
      );
    });

    const newDay = new Day(this.currentDay(), lessons);

    this.days.update((days) => {
      if (!days) return [newDay];

      const dayIndex = days.findIndex(d => d.dayName === this.currentDay());
      dayIndex !== -1 ? days[dayIndex] = newDay : days.push(newDay);

      return days;
    });

    this.currentDay.set(day);

    const existingDay = this.days()?.find(d => d.dayName === day);
    if (!existingDay) {
      this.resetForm();
      return;
    }

    const formatDate = (date : Date) => {
      return date.toTimeString().substring(0, 5);
    }

    existingDay.lessons.forEach((lesson, index) => {
      const { subjectName, teacherName, roomNumber, startTime, endTime } = lesson;
      const lessonGroup = this.dayForm.get(`lesson${ index + 1 }`) as FormGroup;

      lessonGroup.get('subjectName')?.setValue(subjectName);
      lessonGroup.get('teacherName')?.setValue(teacherName);
      lessonGroup.get('roomNumber')?.setValue(roomNumber);
      lessonGroup.get('startTime')?.setValue(formatDate(startTime));
      lessonGroup.get('endTime')?.setValue(formatDate(endTime));
    });
  }

  protected saveTimetable() {
    const days = this.days();
    if (!days) {
      const lessonsValue = this.dayForm.value;
      const lessons = this.lessonsArray.map((lessonNumber) => {
        const lessonGroup = lessonsValue[`lesson${ lessonNumber }`];
        return new Lesson(
          lessonGroup?.subjectName ?? '',
          lessonGroup?.teacherName ?? '',
          lessonGroup?.roomNumber ?? '',
          new Date(`1970-01-01T${ lessonGroup?.startTime ?? '08:00' }:00`),
          new Date(`1970-01-01T${ lessonGroup?.endTime ?? '08:45' }:00`)
        );
      });

      const newDay = new Day(this.currentDay(), lessons);
      this.timetableS.setTimetable = [newDay];
      this.router.navigate(['/timetable']).then();
      return;
    }

    const currentFormLessons = this.lessonsArray.map((lessonNumber) => {
      const lessonGroup = this.dayForm.value[`lesson${ lessonNumber }`];
      return new Lesson(
        lessonGroup?.subjectName ?? '',
        lessonGroup?.teacherName ?? '',
        lessonGroup?.roomNumber ?? '',
        new Date(`1970-01-01T${ lessonGroup?.startTime ?? '08:00' }:00`),
        new Date(`1970-01-01T${ lessonGroup?.endTime ?? '08:45' }:00`)
      );
    });

    this.days.update((d) => {
      const dayIndex = d!.findIndex(day => day.dayName === this.currentDay());
      if (dayIndex !== -1) {
        d![dayIndex].lessons = currentFormLessons;
      } else {
        d!.push(new Day(this.currentDay(), currentFormLessons));
      }
      return d;
    });

    this.timetableS.setTimetable = days;
    this.router.navigate(['/timetable']).then();
  }

  protected clearTimetable() {
    this.days.set(null);
    this.resetForm();
  }
}
