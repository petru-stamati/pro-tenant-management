import { PartialType, OmitType } from '@nestjs/mapped-types';
import { CreateLeaseDto } from './create-lease.dto';

export class UpdateLeaseDto extends PartialType(OmitType(CreateLeaseDto, ['apartmentId', 'tenantId'] as const)) {}
