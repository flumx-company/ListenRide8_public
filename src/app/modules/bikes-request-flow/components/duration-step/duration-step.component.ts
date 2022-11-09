import { Component, Input } from '@angular/core';
import { FormGroup } from '@angular/forms';
import { BikesRequestFlowComponent } from '../../bikes-request-flow.component';

@Component({
  selector: 'lnr-step-duration',
  templateUrl: './duration-step.component.html',
  styleUrls: ['./duration-step.component.scss'],
})
export class DurationStepComponent {
  @Input() durationFormGroup: FormGroup;
  @Input() hasInsurance: boolean;
  @Input('image_file') image_file;
  @Input('brand') brand;
  @Input('name') name;
  @Input('type') type;
  @Input('city') city;
  constructor(private bikesRequestFlowComponent: BikesRequestFlowComponent) {}

  request() {
    this.bikesRequestFlowComponent.requestFlow();
  }
}
