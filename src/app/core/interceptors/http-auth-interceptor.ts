import {
  BehaviorSubject,
  Observable,
  throwError as observableThrowError,
} from 'rxjs';
import { catchError, filter, finalize, switchMap, take } from 'rxjs/operators';
import { Injectable, Injector } from '@angular/core';
import {
  HttpErrorResponse,
  HttpEvent,
  HttpHandler,
  HttpInterceptor,
  HttpRequest,
} from '@angular/common/http';
import { TokensEnum } from '@enums/tokens.enum';
import { OauthRefreshRequest } from '@models/oauth/oauth-refresh-request';
import { ApiOauthService } from '@api/api-oauth/api-oauth.service';
import { ErrorHttpEnum } from '@enums/error-http.enum';
import { AuthActions } from '@auth/store/actions';
import { Store } from '@ngrx/store';
import * as fromAuth from '@auth/store/reducers';
import { environment } from '@environment/environment';

@Injectable()
export class HttpAuthInterceptor implements HttpInterceptor {
  private isRefreshingToken = false;

  private tokenSubject: BehaviorSubject<any> = new BehaviorSubject<any>(null);

  private apiOauthService = this.injector.get(ApiOauthService);

  constructor(
    private injector: Injector,
    private storeAuth: Store<fromAuth.State>,
  ) {}

  intercept(
    req: HttpRequest<any>,
    next: HttpHandler,
  ): Observable<HttpEvent<any>> {
    return next.handle(this.addTokens(req)).pipe(
      catchError(error => {
        return this.processError(req, next, error);
      }),
    );
  }

  private processError(
    req: HttpRequest<any>,
    next: HttpHandler,
    error: any,
  ): Observable<HttpEvent<any>> {
    if (error instanceof HttpErrorResponse) {
      switch ((error as HttpErrorResponse).status) {
        case 401: {
          return this.handle401Error(req, next, error);
        }
        default:
          return observableThrowError(error);
      }
    } else {
      return observableThrowError(error);
    }
  }

  handle401Error(
    req: HttpRequest<any>,
    next: HttpHandler,
    error: HttpErrorResponse,
  ) {
    switch (error.error.errors[0].detail) {
      case ErrorHttpEnum.ERROR_UNAUTHORIZED_TOKEN_EXPIRED: {
        return this.refreshToken(req, next);
      }
      case ErrorHttpEnum.ERROR_LOGIN_CREDENTIALS_INVALID: {
        return observableThrowError(error);
      }
      default: {
        return this.logoutUser(error);
      }
    }
  }

  // TODO Fix to avoid eslint-ignore
  // eslint-disable-next-line class-methods-use-this
  private addTokens(req: HttpRequest<any>): HttpRequest<any> {
    const accessToken = localStorage.getItem(TokensEnum.ACCESS_TOKEN);

    if (accessToken) {
      const tokenType = localStorage.getItem(TokensEnum.TOKEN_TYPE);
      return req.clone({
        setHeaders: {
          [TokensEnum.ACCESS_TOKEN]: `${tokenType} ${accessToken}`,
        },
      });
    }
    return req;
  }

  private refreshToken(req: HttpRequest<any>, next: HttpHandler) {
    if (!this.isRefreshingToken) {
      this.isRefreshingToken = true;

      // Reset here so that the following requests wait until the token
      // comes back from the refreshToken call.
      this.tokenSubject.next(null);

      // TODO Fix to be camelCase
      const oauthRefreshRequest: OauthRefreshRequest | any = {
        // eslint-disable-next-line @typescript-eslint/camelcase
        grant_type: 'refresh_token',
        // eslint-disable-next-line @typescript-eslint/camelcase
        client_id: environment.LNR_DOORKEEPER_CLIENT_ID,
        // eslint-disable-next-line @typescript-eslint/camelcase
        refresh_token: localStorage.getItem(TokensEnum.REFRESH_TOKEN),
      };

      if (!oauthRefreshRequest.refresh_token) {
        return observableThrowError(ErrorHttpEnum.HAVEN_T__TOKENS);
      }

      return this.apiOauthService.refresh(oauthRefreshRequest).pipe(
        // TODO Fix to avoid eslint-ignore
        // eslint-disable-next-line consistent-return
        switchMap(newTokens => {
          if (newTokens) {
            this.tokenSubject.next(newTokens);
            return next.handle(this.addTokens(req));
          }
        }),
        catchError(err => {
          return this.processError(req, next, err);
        }),
        finalize(() => {
          this.isRefreshingToken = false;
        }),
      );
    }
    return this.tokenSubject.pipe(
      filter(token => !!token),
      take(1),
      switchMap(token => {
        return next.handle(this.addTokens(req));
      }),
    );
  }

  private logoutUser(error) {
    this.storeAuth.dispatch(AuthActions.openLoginDialog());
    return observableThrowError(error);
  }
}
