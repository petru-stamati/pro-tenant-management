import { IsIn } from 'class-validator';

export class ProposalDecisionDto {
  @IsIn(['APPROVED', 'REJECTED'])
  decision!: 'APPROVED' | 'REJECTED';
}
