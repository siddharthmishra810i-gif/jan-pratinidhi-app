import { Entity, PrimaryGeneratedColumn, Column, CreateDateColumn, UpdateDateColumn } from 'typeorm';

@Entity('politicians')
export class Politician {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column()
  name: string;

  @Column({ nullable: true })
  dob: Date;

  @Column({ nullable: true })
  gender: string;

  @Column({ nullable: true })
  education: string;

  @Column({ nullable: true })
  profession: string;

  @Column({ nullable: true })
  criminal_cases_count: number;

  @Column({ type: 'bigint', nullable: true })
  total_assets: number;

  @Column({ type: 'bigint', nullable: true })
  total_liabilities: number;
  
  @Column({ type: 'jsonb', nullable: true })
  social_links: any;

  @Column({ type: 'float', nullable: true })
  confidence_score: number; // 100=verified, 80=multi-source, 50=single-source

  @CreateDateColumn()
  created_at: Date;

  @UpdateDateColumn()
  updated_at: Date;
}
