import { BadRequestException, Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { EntityManager, Repository } from 'typeorm';
import { CreditMovement, CreditReason } from './credit-movement.entity';

@Injectable()
export class CreditsService {
  constructor(
    @InjectRepository(CreditMovement) private readonly movements: Repository<CreditMovement>,
  ) {}

  async balance(userId: string, manager?: EntityManager): Promise<number> {
    const repo = manager?.getRepository(CreditMovement) ?? this.movements;
    const row = await repo
      .createQueryBuilder('m')
      .select('COALESCE(SUM(m.amountMillimes), 0)', 'total')
      .where('m.userId = :userId', { userId })
      .getRawOne<{ total: string }>();
    return Number(row?.total ?? 0);
  }

  async history(userId: string) {
    const [balance, items] = await Promise.all([
      this.balance(userId),
      this.movements.find({
        where: { user: { id: userId } },
        order: { createdAt: 'DESC' },
        take: 50,
      }),
    ]);
    return { balanceMillimes: balance, movements: items };
  }

  /** Écrit un mouvement dans la transaction en cours (paiement, remboursement, recharge). */
  async record(
    manager: EntityManager,
    userId: string,
    amountMillimes: number,
    reason: CreditReason,
    label: string,
    requestId: string | null = null,
  ): Promise<void> {
    await manager.getRepository(CreditMovement).insert({
      user: { id: userId },
      amountMillimes,
      reason,
      label,
      requestId,
    });
  }

  /** Débite le solde ou refuse l'opération s'il ne suffit pas. */
  async debit(
    manager: EntityManager,
    userId: string,
    amountMillimes: number,
    label: string,
    requestId: string | null = null,
  ): Promise<void> {
    const balance = await this.balance(userId, manager);
    if (balance < amountMillimes) {
      throw new BadRequestException('Solde de crédits insuffisant : recharge ou paie par carte.');
    }
    await this.record(manager, userId, -amountMillimes, 'paiement', label, requestId);
  }

  /** Recharge simulée (pas de vrai paiement dans le prototype). */
  async recharge(userId: string, amountDt: number) {
    await this.movements.manager.transaction((m) =>
      this.record(m, userId, Math.round(amountDt * 1000), 'recharge', 'Recharge par carte (simulée)'),
    );
    return this.history(userId);
  }
}
