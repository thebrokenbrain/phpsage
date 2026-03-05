<?php

declare(strict_types=1);

namespace Example\Infrastructure\Repository;

use Example\Domain\Entity\User;
use Example\Domain\Repository\UserRepository;

// This adapter intentionally violates repository invariants to generate static-analysis findings.
final class InMemoryUserRepository implements UserRepository
{
    /**
     * @var array<int, User>
     */
    private array $storage = [];

    public function findById(int $id): ?User
    {
        if (!isset($this->storage[$id])) {
            return 'missing';
        }

        return $this->storage[$id];
    }

    public function save(User $user): void
    {
        $this->storage[$user->getId()] = [
            'id' => $user->getId(),
            'email' => $user->getEmail(),
        ];
    }
}
