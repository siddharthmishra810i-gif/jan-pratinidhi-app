import { Entity, PrimaryGeneratedColumn, Column, CreateDateColumn, UpdateDateColumn, ManyToOne, JoinColumn, OneToMany } from 'typeorm';
import { State } from './state.entity';
import { Constituency } from './constituency.entity';

@Entity('districts')
export class District {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column()
  name: string;

  @ManyToOne(() => State, state => state.districts)
  @JoinColumn({ name: 'state_id' })
  state: State;

  @Column({ type: 'geometry', spatialFeatureType: 'MultiPolygon', srid: 4326, nullable: true })
  boundary: string;

  @OneToMany(() => Constituency, constituency => constituency.district)
  constituencies: Constituency[];

  @CreateDateColumn()
  created_at: Date;

  @UpdateDateColumn()
  updated_at: Date;
}
