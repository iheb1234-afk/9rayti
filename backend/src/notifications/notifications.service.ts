import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Observable, Subject, filter, interval, map, merge } from 'rxjs';
import { EntityManager, IsNull, Repository } from 'typeorm';
import { User } from '../users/user.entity';
import { Notification, NotificationType } from './notification.entity';

/** Événement poussé en temps réel au navigateur (Server-Sent Events). */
export interface LiveEvent {
  userId: string;
  type: 'notification' | 'message' | 'ping';
  data: unknown;
}

/**
 * Notifications enregistrées en base (pour l'historique) et poussées en direct aux
 * navigateurs ouverts. Le flux est en mémoire : suffisant pour une instance ; avec
 * plusieurs serveurs, on passerait par Redis (pub/sub).
 */
@Injectable()
export class NotificationsService {
  private readonly bus = new Subject<LiveEvent>();

  constructor(@InjectRepository(Notification) private readonly notifications: Repository<Notification>) {}

  view(n: Notification) {
    return { id: n.id, type: n.type, params: n.params, link: n.link, readAt: n.readAt, createdAt: n.createdAt };
  }

  /** Enregistre une notification (dans la transaction en cours si on en passe une) et la pousse en direct. */
  async notify(
    m: EntityManager | null,
    userId: string,
    type: NotificationType,
    params: Record<string, string | number> = {},
    link: string | null = null,
  ) {
    const repo = (m ?? this.notifications.manager).getRepository(Notification);
    const saved = await repo.save(repo.create({ user: { id: userId }, type, params, link }));
    this.bus.next({ userId, type: 'notification', data: this.view(saved) });
    return saved;
  }

  /** Prévient tous les administrateurs (nouveau signalement, message de contact…). */
  async notifyAdmins(
    m: EntityManager | null,
    type: NotificationType,
    params: Record<string, string | number>,
    link: string,
  ) {
    const admins = await (m ?? this.notifications.manager)
      .getRepository(User)
      .find({ where: { role: 'admin' }, select: { id: true } });
    for (const a of admins) await this.notify(m, a.id, type, params, link);
  }

  /** Pousse un événement sans le stocker (ex. un nouveau message dans une conversation ouverte). */
  push(userId: string, type: LiveEvent['type'], data: unknown) {
    this.bus.next({ userId, type, data });
  }

  async list(userId: string) {
    const [items, unread] = await Promise.all([
      this.notifications.find({ where: { user: { id: userId } }, order: { createdAt: 'DESC' }, take: 30 }),
      this.notifications.count({ where: { user: { id: userId }, readAt: IsNull() } }),
    ]);
    return { unread, items: items.map((n) => this.view(n)) };
  }

  async markRead(userId: string, id?: string) {
    await this.notifications.update(
      { user: { id: userId }, readAt: IsNull(), ...(id ? { id } : {}) },
      { readAt: new Date() },
    );
    return this.list(userId);
  }

  /** Flux d'un utilisateur, avec un « ping » toutes les 25 s pour garder la connexion ouverte. */
  stream(userId: string): Observable<{ type: string; data: unknown }> {
    return merge(
      this.bus.pipe(filter((e) => e.userId === userId)),
      interval(25_000).pipe(map(() => ({ userId, type: 'ping' as const, data: Date.now() }))),
    ).pipe(map((e) => ({ type: e.type, data: e.data })));
  }
}
