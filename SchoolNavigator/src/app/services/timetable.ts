import { inject, Injectable, PLATFORM_ID } from '@angular/core';
import { isPlatformBrowser } from "@angular/common";
import { Room } from "@services/map.service";

export type DayName = 'Poniedziałek' | 'Wtorek' | 'Środa' | 'Czwartek' | 'Piątek';

export class Day {
  public dayName : DayName;
  public lessons : Lesson[];

  constructor(dayname : DayName, lessons : Lesson[]) {
    this.dayName = dayname;
    this.lessons = lessons;
  }
}

export class Lesson {
  public subjectName : string;
  public teacherName : string
  public roomNumber : Room['room_number'];
  public startTime : Date;
  public endTime : Date;

  constructor(subjectName : string, teacherName : string, roomNumber : Room['room_number'], startTime : Date, endTime : Date) {
    this.subjectName = subjectName;
    this.teacherName = teacherName;
    this.roomNumber = roomNumber;
    this.startTime = startTime;
    this.endTime = endTime;
  }
}


@Injectable({
  providedIn : 'root',
})
export class Timetable {
  private platformId = inject(PLATFORM_ID);

  public get getTimetable() {
    if (!isPlatformBrowser(this.platformId))
      throw new Error('Timetable can only be called in the browser');

    const data = localStorage.getItem('timetable');
    if (!data)
      return null;

    return JSON.parse(data) as Day[];
  }

  public set setTimetable(timetable : Day[] | null) {
    if (!isPlatformBrowser(this.platformId))
      throw new Error('Timetable can only be called in the browser');

    if (!timetable) {
      localStorage.removeItem('timetable');
      return;
    }

    localStorage.setItem('timetable', JSON.stringify(timetable));
  }
}
