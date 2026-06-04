import { Entity, PrimaryGeneratedColumn, Column, CreateDateColumn, UpdateDateColumn, ManyToOne, JoinColumn } from 'typeorm';
import { State } from './state.entity';
import { District } from './district.entity';

export enum ConstituencyType {
  LOK_SABHA = 'LOK_SABHA',
  VIDHAN_SABHA = 'VIDHAN_SABHA',
}

@Entity('constituencies')
export class Constituency {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column()
  name: string;

  @Column({
    type: 'enum',
    enum: ConstituencyType,
  })
  type: ConstituencyType;

  @Column({ nullable: true })
  no: number; // Constituency Number

  @ManyToOne(() => State, state => state.constituencies)
  @JoinColumn({ name: 'state_id' })
  state: State;

  @ManyToOne(() => District, district => district.constituencies, { nullable: true })
  @JoinColumn({ name: 'district_id' })
  district: District;

  @Column({ type: 'geometry', spatialFeatureType: 'MultiPolygon', srid: 4326, nullable: true })
  boundary: string;
  
  @Column({ type: 'jsonb', nullable: true })
  summary: any; // AI generated summary placeholder

  @CreateDateColumn()
  created_at: Date;

  @UpdateDateColumn()
  updated_at: Date;
}
