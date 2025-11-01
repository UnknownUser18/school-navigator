import { TestBed } from '@angular/core/testing';

import { TooltipRegistry } from './tooltip-registry';

describe('TooltipRegistry', () => {
  let service: TooltipRegistry;

  beforeEach(() => {
    TestBed.configureTestingModule({});
    service = TestBed.inject(TooltipRegistry);
  });

  it('should be created', () => {
    expect(service).toBeTruthy();
  });
});
