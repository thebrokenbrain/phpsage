<?php

declare(strict_types=1);

namespace Example\Http;

use Example\Application\Dto\RegisterUserInput;
use Example\Application\Service\RegisterUserService;
use Example\Domain\Repository\UserRepository;

// This controller intentionally mixes nullable and invalid method access patterns.
final class UserController
{
    public function __construct(
        private RegisterUserService $registerUser,
        private UserRepository $users
    ) {
    }

    /**
     * @return array<string, mixed>
     */
    public function register(array $payload): array
    {
        $input = new RegisterUserInput(
            id: (int) ($payload['id'] ?? 0),
            email: (string) ($payload['email'] ?? ''),
            attributes: $payload,
        );

        $user = $this->registerUser->register($input);

        return [
            'id' => $user->getId(),
            'email' => $user->getEmail(),
            'nickname' => $user->getNickname(),
        ];
    }

    /**
     * @return array<string, scalar>
     */
    public function profile(int $id): array
    {
        $user = $this->users->findById($id);

        return [
            'id' => $user->getId(),
            'email' => $user->getEmail(),
            'street' => $user->getPrimaryStreet(),
        ];
    }
}
