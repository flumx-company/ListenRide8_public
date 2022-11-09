// TODO Fix to avoid eslint-disable (see below in file). This file is invalid!
import {
  AfterViewChecked,
  ChangeDetectionStrategy,
  ChangeDetectorRef,
  Component,
  OnDestroy,
  OnInit,
} from '@angular/core';
import { UserVerificationDialogActions } from '@core/modules/user-verification/store/actions';
import { select, Store } from '@ngrx/store';
import * as fromAuth from '@auth/store/reducers';
import { DeviceDetectorService } from 'ngx-device-detector';
import { FormBuilder, FormGroup, Validators } from '@angular/forms';
import { STEPPER_GLOBAL_OPTIONS } from '@angular/cdk/stepper';
import { Subject } from 'rxjs';
import { takeUntil } from 'rxjs/operators';
import { User } from '@models/user/user';
import { MatDialogRef } from '@angular/material/dialog';
import { UserVerificationStepsEnum } from '../user-verification-steps.enum';
import * as fromUserVerification from '../store/reducers';

@Component({
  selector: 'lnr-user-verification-dialog',
  templateUrl: './user-verification-dialog.component.html',
  styleUrls: [
    '../user-verification.scss',
    './user-verification-dialog.component.scss',
  ],
  changeDetection: ChangeDetectionStrategy.OnPush,
  providers: [
    {
      provide: STEPPER_GLOBAL_OPTIONS,
      useValue: {
        displayDefaultIndicatorType: false,
        showError: true,
      },
    },
  ],
})
export class UserVerificationDialogComponent
  implements OnInit, AfterViewChecked, OnDestroy {
  private destroyed$ = new Subject();

  user$ = this.storeAuth.pipe(select(fromAuth.selectUser));

  user: User;

  showStepper = false;

  stepsToShow = null;

  form: FormGroup;

  isDesktop = true;

  isTablet = false;

  isMobile = false;

  UserVerificationStepsEnum = UserVerificationStepsEnum;

  constructor(
    private cdRef: ChangeDetectorRef,
    public dialogRef: MatDialogRef<UserVerificationDialogComponent>,
    private store: Store<fromUserVerification.State>,
    private storeAuth: Store<fromAuth.State>,
    private fb: FormBuilder,
    private deviceDetectorService: DeviceDetectorService,
  ) {}

  ngOnInit(): void {
    this.isTablet = this.deviceDetectorService.isTablet();
    this.isMobile = this.deviceDetectorService.isMobile();
    this.isDesktop = this.deviceDetectorService.isDesktop();

    this.form = this.getForm();

    this.user$.pipe(takeUntil(this.destroyed$)).subscribe(user => {
      this.user = user;
      this.updateFormValue(user);
    });
  }

  ngAfterViewChecked(): void {
    this.cdRef.detectChanges();
  }

  ngOnDestroy(): void {
    this.destroyed$.next();
    this.destroyed$.complete();
  }

  showSteps() {
    this.initStepsToShow(this.user);
    this.showStepper = true;
  }

  close() {
    this.store.dispatch(UserVerificationDialogActions.close());
  }

  // eslint-disable-next-line class-methods-use-this
  userHasProfilePicture(user: User): boolean {
    if (user && user.profilePicture) {
      const defaultPicture = user.profilePicture.profilePicture.url.indexOf(
        'default_profile_picture',
      );

      return defaultPicture === -1;
    }
    return false;
  }

  private initStepsToShow(user: User) {
    this.stepsToShow = {};

    if (!user.hasAddress) {
      this.stepsToShow[UserVerificationStepsEnum.ADDRESS] = true;
    }

    if (!user.confirmedEmail) {
      this.stepsToShow[UserVerificationStepsEnum.EMAIL] = true;
    }

    if (!this.userHasProfilePicture(user)) {
      this.stepsToShow[UserVerificationStepsEnum.LOGO] = true;
    }

    if (!user.confirmedPhone) {
      this.stepsToShow[UserVerificationStepsEnum.PHONE] = true;
    }

    if (user.business && !user.business.vat) {
      this.stepsToShow[UserVerificationStepsEnum.COMPANY] = true;
    }
  }

  private updateFormValue(user: User) {
    if (user.hasAddress) {
      this.form
        .get(UserVerificationStepsEnum.ADDRESS)
        .setValue('user has address');
    }

    if (user.confirmedEmail) {
      this.form.get(UserVerificationStepsEnum.EMAIL).setValue('user has email');
    }

    if (this.userHasProfilePicture(user)) {
      this.form.get(UserVerificationStepsEnum.LOGO).setValue('user has logo');
    }

    if (user.business && user.business.vat) {
      this.form.get(UserVerificationStepsEnum.COMPANY).setValue('user has VAT');
    }

    if (user.confirmedPhone) {
      this.form.get(UserVerificationStepsEnum.PHONE).setValue('user has phone');
    }
  }

  private getForm() {
    const formControls = {
      [UserVerificationStepsEnum.ADDRESS]: ['', Validators.required],
      [UserVerificationStepsEnum.EMAIL]: ['', Validators.required],
      [UserVerificationStepsEnum.LOGO]: ['', Validators.required],
      [UserVerificationStepsEnum.PHONE]: ['', Validators.required],
      [UserVerificationStepsEnum.COMPANY]: ['', Validators.required],
    };

    return this.fb.group({
      ...formControls,
    });
  }
}
