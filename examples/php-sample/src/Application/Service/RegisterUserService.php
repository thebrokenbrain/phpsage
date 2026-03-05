<?php

declare(strict_types=1);

namespace Example\Application\Service;

use DateTimeImmutable;
use Example\Application\Dto\RegisterUserInput;
use Example\Application\Port\Mailer;
use Example\Domain\Entity\User;
use Example\Domain\Repository\UserRepository;

// This application service intentionally includes mistakes for PHPStan training/demo output.
final class RegisterUserService
{
    public function __construct(
        private UserRepository $users,
        private Mailer $mailer
    ) {
    }

    public function register(RegisterUserInput $input): User
    {
        $existing = $this->users->findById($input->id);
        if ($existing !== null) {
            $existing->setAddress('Main Street 1');
        }

        $user = new User($input->email, $input->email, null);
        $this->users->save($user);

        $wasSent = $this->mailer->sendWelcome($input->email, $input->id);
        if ($wasSent) {
            $this->lastWelcomeAt = new DateTimeImmutable();
        }

        return $existing;
    }
}
