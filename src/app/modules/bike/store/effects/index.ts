import { Injectable } from '@angular/core';
import { Location } from '@angular/common';
import { Actions, ofType, OnInitEffects, createEffect } from '@ngrx/effects';
import { ApiRidesService } from '@api/api-rides/api-rides.service';
import {
  catchError,
  filter,
  first,
  map,
  mergeMap,
  pairwise,
  startWith,
  tap,
  withLatestFrom,
} from 'rxjs/operators';
import { Action, Store } from '@ngrx/store';
import { Router, ActivatedRoute } from '@angular/router';
import { URL_DATE_FORMAT, HOUR, DATE_FORMAT } from '@core/constants/time';
import get from 'lodash-es/get';
import * as moment from 'moment';
import { ExpandedBikeData } from '@models/bike/bike.types';
import * as BikeActions from '../actions';
import { BIKE_DATA, BikeState, BookingData, ENGAGED_TIME } from '../../types';
import { selectBookingData, selectCurrentBikeData } from '../index';
import { checkIsBikeLoaded } from '../helpers';

@Injectable()
export class BikeEffects implements OnInitEffects {
  private loadedBikeEngagedTimeData: ExpandedBikeData;

  $loadBike = createEffect(() =>
    this.actions$.pipe(
      ofType(BikeActions.loadBike),
      withLatestFrom(this.store$.select(selectCurrentBikeData)),
      filter(
        ([{ bikeId }, currentBikeData]) =>
          !currentBikeData || Number(bikeId) !== currentBikeData.id,
      ),
      tap(() =>
        this.store$.dispatch(BikeActions.setLoadingData({ data: BIKE_DATA })),
      ),
      mergeMap(([{ bikeId }]) =>
        this.apiRidesService.getExpandedBikeData(bikeId).pipe(
          map(bikeData => BikeActions.setBike({ bikeData })),
          catchError(async (error: Error) => {
            await this.router.navigate(['404']);
            return BikeActions.setErrorGetBike(error);
          }),
        ),
      ),
    ),
  );

  $processSelectedHours = createEffect(
    () =>
      this.actions$.pipe(
        ofType(BikeActions.setSelectedHours),
        withLatestFrom(
          this.store$.select(selectBookingData),
          this.store$.select(selectCurrentBikeData),
          (action, bookingData, bikeData) => {
            const { pickUpHour, returnHour } = bookingData;

            if (pickUpHour && returnHour) {
              this.processSelectedHoursChange(bookingData, bikeData);
            }
          },
        ),
      ),
    { dispatch: false },
  );

  $processSetBikeFromVariations = createEffect(
    () =>
      this.actions$.pipe(
        ofType(BikeActions.setBikeFromVariations),
        withLatestFrom(
          this.store$
            .select(selectCurrentBikeData)
            .pipe(startWith(null), pairwise()),
          (action, [prevBikeData, bikeData]) => {
            const { location } = window;
            const newLocation = `${location.pathname}${location.search}`.replace(
              String(prevBikeData.id),
              String(bikeData.id),
            );

            this.location.replaceState(newLocation);
          },
        ),
      ),
    { dispatch: false },
  );

  $loadEngagedTime = createEffect(() =>
    this.actions$.pipe(
      ofType(BikeActions.loadEngagedTime),
      withLatestFrom(this.store$.select(selectCurrentBikeData)),
      filter(([{ startDate }, bikeData]) => {
        if (
          !startDate &&
          !checkIsBikeLoaded(bikeData, this.loadedBikeEngagedTimeData)
        ) {
          this.loadInitialEngagedTimeData();
          this.loadedBikeEngagedTimeData = bikeData;
        }
        return startDate && !!bikeData;
      }),
      mergeMap(([{ startDate, endDate }, { id }]) =>
        this.apiRidesService
          .getEngagedTimeData(id, startDate, endDate)
          .pipe(
            map(engagedTime => BikeActions.setEngagedTime({ engagedTime })),
          ),
      ),
    ),
  );

  constructor(
    private actions$: Actions,
    private apiRidesService: ApiRidesService,
    private store$: Store<BikeState>,
    private router: Router,
    private route: ActivatedRoute,
    private location: Location,
  ) {}

  ngrxOnInitEffects(): Action {
    this.route.queryParams.pipe().subscribe(params => {
      const { duration } = params;
      const paramsStart = get(params, 'start_date', '');
      const isValidDate = moment(paramsStart, URL_DATE_FORMAT, true).isValid();

      if (isValidDate && duration >= HOUR) {
        const startDate = moment(paramsStart);
        const endDate = moment(startDate).add(
          parseInt(duration, 10),
          'seconds',
        );

        this.store$.dispatch(
          BikeActions.setSelectedDays({
            startDay: startDate.format(DATE_FORMAT),
            endDay: endDate.format(DATE_FORMAT),
          }),
        );
        this.store$.dispatch(
          BikeActions.setSelectedHours({
            pickUpHour: startDate.hours(),
            returnHour: endDate.hours(),
          }),
        );
      }
    });
    return { type: '' };
  }

  processSelectedHoursChange(
    bookingData: BookingData,
    bikeData: ExpandedBikeData,
  ): void {
    const { pickUpHour, returnHour, startDay, endDay } = bookingData;
    const startDate = moment(startDay).hour(pickUpHour);
    const startDateStr = startDate.format(URL_DATE_FORMAT);
    const endDate = moment(endDay)
      .hour(returnHour)
      .startOf('hour');
    const duration = endDate.diff(startDate, 'seconds');

    if (duration >= HOUR) {
      const { location } = window;
      const searchParams = new URLSearchParams(location.search);

      searchParams.set('start_date', startDateStr);
      searchParams.set('duration', String(duration));
      this.location.replaceState(
        `${location.pathname}?${searchParams.toString()}`,
      );
    }
    if (bikeData && bikeData.clusterId) {
      this.apiRidesService
        .getAvailableSizesByCluster(bikeData.clusterId, startDateStr, duration)
        .pipe(first())
        .subscribe(({ rideIds }) => {
          this.store$.dispatch(BikeActions.setAvailableVariations({ rideIds }));
        });
    }
  }

  loadInitialEngagedTimeData(): void {
    const today = moment().format(DATE_FORMAT);
    const endDate = moment()
      .add(1, 'month')
      .endOf('month')
      .format(DATE_FORMAT);

    this.store$.dispatch(BikeActions.setEngagedTime({}));
    this.store$.dispatch(BikeActions.setLoadingData({ data: ENGAGED_TIME }));
    this.store$.dispatch(
      BikeActions.loadEngagedTime({ startDate: today, endDate }),
    );
  }
}
