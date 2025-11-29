import { Pipe, PipeTransform } from '@angular/core';

@Pipe({
  name : 'convertTime'
})
export class ConvertTimePipe implements PipeTransform {

  transform(value : Date) : string {
    return new Date(value).toTimeString().substring(0, 5);
  }
}
