<?php

declare(strict_types=1);

namespace Example\Domain\Repository;

use Example\Domain\Entity\User;

// This contract defines persistence operations for users.
interface UserRepository
{
    public function findById(int $id): ?User;

    public function save(User $user): void;
}
