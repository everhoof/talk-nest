import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { GraphQLModule } from '@nestjs/graphql';
import { ApolloDriver, ApolloDriverConfig } from '@nestjs/apollo';
import { join } from 'path';
import { ScheduleModule } from '@nestjs/schedule';
import { UsersModule } from '@modules/users/users.module';
import { AccountsModule } from '@modules/accounts/accounts.module';
import { RolesModule } from '@modules/roles/roles.module';
import { AppResolver } from './app.resolver';
import { PicturesModule } from '@modules/pictures/pictures.module';
import { MessagesModule } from '@modules/messages/messages.module';
import { UploadModule } from '@modules/upload/upload.module';
import { APP_INTERCEPTOR } from '@nestjs/core';
import { DataLoaderInterceptor } from '@modules/common/graphql/dataloader';
import { CommonModule } from '@modules/common/common.module';
import { MailerModule } from '@nestjs-modules/mailer';
import { HandlebarsAdapter } from '@nestjs-modules/mailer/dist/adapters/handlebars.adapter';
import { TypeOrmConfigService } from '@modules/common/typeorm';
import { ConfigModule } from '@modules/config';
import { EventEmitterModule } from '@nestjs/event-emitter';
import { DonationAlertsModule } from '@modules/donation-alerts/donation-alerts.module';
import { SubscriptionsService } from '@modules/common/graphql/subscriptions.service';
import { formatGraphqlError } from '@modules/common/graphql/format-error';

@Module({
  imports: [
    ConfigModule,
    EventEmitterModule.forRoot(),
    GraphQLModule.forRoot<ApolloDriverConfig>({
      driver: ApolloDriver,
      debug: process.env.NODE_ENV !== 'production',
      autoSchemaFile: process.env.NODE_ENV === 'test' ? true : join(process.cwd(), './graphql/schema.graphql'),
      graphiql: process.env.NODE_ENV !== 'production',
      context: ({ req, res }) => ({ req, res }),
      formatError: formatGraphqlError,
    }),
    TypeOrmModule.forRootAsync({
      useClass: TypeOrmConfigService,
    }),
    MailerModule.forRoot({
      transport: process.env.EMAIL_TRANSPORT,
      defaults: {
        from: `${process.env.EMAIL_DISPLAY_NAME} <${process.env.EMAIL_DISPLAY_EMAIL}>`,
      },
      template: {
        dir: process.cwd() + '/mail/templates',
        adapter: new HandlebarsAdapter(),
        options: {
          strict: true,
        },
      },
    }),
    // ThrottlerModule.forRoot(),
    ScheduleModule.forRoot(),
    CommonModule,
    UsersModule,
    AccountsModule,
    RolesModule,
    PicturesModule,
    MessagesModule,
    UploadModule,
    DonationAlertsModule,
  ],
  providers: [
    AppResolver,
    SubscriptionsService,
    {
      provide: APP_INTERCEPTOR,
      useClass: DataLoaderInterceptor,
    },
  ],
})
export class AppModule {}
