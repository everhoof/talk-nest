import { Inject, Injectable, Logger } from '@nestjs/common';
import { Service } from '../../tokens';
import type { Config } from '@modules/config';
import Centrifuge from 'centrifuge';
import WebSocket from 'ws';
import got, { Got } from 'got';
import { XMLHttpRequest } from 'xmlhttprequest';
import { UserOAuth, UserOAuthResponse } from './models/user-oauth.response';
import { DonationMessage, DonationMessageResponse } from '@modules/donation-alerts/models/donation.message';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { EventTypes } from '@modules/common/events/event-types';
import { DonationEvent } from '@modules/common/events/donation/donation.event';

global.XMLHttpRequest = XMLHttpRequest;

@Injectable()
export class DonationAlertsService {
  private readonly logger = new Logger(DonationAlertsService.name);
  private centrifuge: Centrifuge;
  private httpClient: Got;
  private user: UserOAuth;

  constructor(
    private readonly eventEmitter: EventEmitter2,
    @Inject(Service.CONFIG) private readonly config: Config,
  ) {
    this.initializeHttpClient()
      .then(() => this.getUserOAuth())
      .then((user) => (this.user = user))
      .then(() => this.initializeCentrifuge())
      .then(() => this.connectCentrifuge())
      .then(() => this.subscribeDonations())
      .catch(this.logger.error);
  }

  async initializeHttpClient(): Promise<void> {
    this.httpClient = got.extend({
      prefixUrl: 'https://www.donationalerts.com/',
      headers: {
        Authorization: `Bearer ${this.config.DONATION_ALERTS_TOKEN}`,
      },
    });
  }

  async getUserOAuth(): Promise<UserOAuth> {
    const response = await this.httpClient.get('api/v1/user/oauth').json<UserOAuthResponse>();
    return response.data;
  }

  async initializeCentrifuge(): Promise<void> {
    this.centrifuge = new Centrifuge('wss://centrifugo.donationalerts.com/connection/websocket', {
      websocket: WebSocket,
      subscribeEndpoint: 'https://www.donationalerts.com/api/v1/centrifuge/subscribe',
      subscribeHeaders: {
        Authorization: `Bearer ${this.config.DONATION_ALERTS_TOKEN}`,
      },
    });

    this.centrifuge.setToken(this.user.socket_connection_token);
  }

  async connectCentrifuge(): Promise<string> {
    return new Promise((resolve) => {
      this.centrifuge.on('connect', (context) => {
        resolve(context.client);
      });

      this.centrifuge.on('disconnect', (context) => {
        this.logger.error('Centrifuge disconnected.');
        this.logger.error(context);
      });

      this.centrifuge.connect();
    });
  }

  subscribeDonations(): void {
    this.centrifuge.subscribe(`$alerts:donation_${this.user.id}`, (message: DonationMessageResponse) => {
      this.onDonation(message.data).catch(console.error);
    });
  }

  async onDonation(message: DonationMessage): Promise<void> {
    this.eventEmitter.emit(
      EventTypes.DONATION,
      new DonationEvent({
        id: message.id,
        username: message.username,
        message: message.message,
        amount: message.amount,
        currency: message.currency,
      }),
    );
  }
}
