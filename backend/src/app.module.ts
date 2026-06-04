import { Module } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { TypeOrmModule } from '@nestjs/typeorm';
import { CacheModule } from '@nestjs/cache-manager';
import { BullModule } from '@nestjs/bullmq';
import { ElasticsearchModule } from '@nestjs/elasticsearch';
import { PrometheusModule } from '@willsoto/nestjs-prometheus';
import * as redisStore from 'cache-manager-redis-store';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { CoreModule } from './core/core.module';
import { PoliticiansModule } from './politicians/politicians.module';
import { ElectionsModule } from './elections/elections.module';

@Module({
  imports: [
    // Environment variables
    ConfigModule.forRoot({
      isGlobal: true,
    }),
    
    // Database (PostgreSQL + PostGIS)
    TypeOrmModule.forRootAsync({
      imports: [ConfigModule],
      useFactory: (configService: ConfigService) => ({
        type: 'postgres',
        host: configService.get<string>('DB_HOST', 'localhost'),
        port: configService.get<number>('DB_PORT', 5432),
        username: configService.get<string>('DB_USER', 'postgres'),
        password: configService.get<string>('DB_PASSWORD', 'postgres'),
        database: configService.get<string>('DB_NAME', 'jan_pratinidhi'),
        autoLoadEntities: true,
        synchronize: process.env.NODE_ENV !== 'production', // Use migrations in production
      }),
      inject: [ConfigService],
    }),

    // Redis Caching
    CacheModule.registerAsync({
      isGlobal: true,
      imports: [ConfigModule],
      useFactory: (configService: ConfigService) => ({
        store: redisStore,
        host: configService.get<string>('REDIS_HOST', 'localhost'),
        port: configService.get<number>('REDIS_PORT', 6379),
      }),
      inject: [ConfigService],
    }),

    // BullMQ Queue
    BullModule.forRootAsync({
      imports: [ConfigModule],
      useFactory: (configService: ConfigService) => ({
        connection: {
          host: configService.get<string>('REDIS_HOST', 'localhost'),
          port: configService.get<number>('REDIS_PORT', 6379),
        },
      }),
      inject: [ConfigService],
    }),

    // ElasticSearch
    ElasticsearchModule.registerAsync({
      imports: [ConfigModule],
      useFactory: async (configService: ConfigService) => ({
        node: configService.get<string>('ELASTICSEARCH_NODE', 'http://localhost:9200'),
      }),
      inject: [ConfigService],
    }),

    // Prometheus Metrics
    PrometheusModule.register({
      path: '/metrics',
      defaultMetrics: {
        enabled: true,
      },
    }),

    CoreModule,

    PoliticiansModule,

    ElectionsModule,
  ],
  controllers: [AppController],
  providers: [AppService],
})
export class AppModule {}
