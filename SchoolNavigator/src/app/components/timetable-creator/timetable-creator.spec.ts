import { ComponentFixture, TestBed } from '@angular/core/testing';

import { TimetableCreator } from './timetable-creator';

describe('TimetableCreator', () => {
  let component: TimetableCreator;
  let fixture: ComponentFixture<TimetableCreator>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [TimetableCreator]
    })
    .compileComponents();

    fixture = TestBed.createComponent(TimetableCreator);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
