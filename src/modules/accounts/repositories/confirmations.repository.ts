import { Injectable } from '@nestjs/common';
import { InjectEntityManager } from '@nestjs/typeorm';
import { EntityManager } from 'typeorm';
import { Confirmation } from '@modules/accounts/entities/confirmations.entity';
import { ConfirmationType } from '@modules/accounts/types/confirmation-type.enum';
import { InternalServerErrorException } from '@nestjs/common';
import { Utils } from '@modules/common/utils/utils';
import { BasicRepository } from '@modules/common/repositories/basic.repository';

@Injectable()
export class ConfirmationsRepository extends BasicRepository<Confirmation> {
  constructor(@InjectEntityManager() manager: EntityManager) {
    super(Confirmation, manager);
  }

  async createNewConfirmation(userId: number, type: ConfirmationType, sendCount = 0): Promise<Confirmation> {
    if (!userId) throw new InternalServerErrorException('UNKNOWN');

    let confirmationEntity: Confirmation | null = await this.findOne({ where: { userId, type } });
    if (confirmationEntity) {
      confirmationEntity.createdAt = new Date();
    } else {
      const confirmationString = await this.createConfirmationString();
      confirmationEntity = this.create({
        value: confirmationString,
        userId,
        type,
        sendCount,
      });
    }

    return this.saveAndReturn(confirmationEntity);
  }

  getConfirmationByValue(value: string): Promise<Confirmation | null> {
    if (!value) return Promise.resolve(null);
    return this.findOne({ where: { value } });
  }

  private async createConfirmationString(): Promise<string> {
    const newValue = Utils.getRandomString();
    const value = await this.findOne({ where: { value: newValue } });
    return value ? this.createConfirmationString() : newValue;
  }

  findOnePasswordResetByUserId(userId: number): Promise<Confirmation | null> {
    return this.findOne({ where: { userId, type: ConfirmationType.password } });
  }
}
