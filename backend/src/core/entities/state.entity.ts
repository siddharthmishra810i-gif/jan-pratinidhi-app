import { Entity, PrimaryGeneratedColumn, Column, CreateDateColumn, UpdateDateColumn, OneToMany } from 'typeorm';
import { District } from './district.entity';
import { Constituency } from './constituency.entity';

@Entity('states')
export class State {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ unique: true })
  name: string;

  @Column({ unique: true })
  code: string;

  @Column({ type: 'geometry', spatialFeatureType: 'MultiPolygon', srid: 4326, nullable: true })
  boundary: string;

  @OneToMany(() => District, district => district.state)
  districts: District[];

  @OneToMany(() => Constituency, constituency => constituency.state)
  constituencies: Constituency[];

  @CreateDateColumn()
  created_at: Date;

  @UpdateDateColumn()
  updated_at: Date;
}
