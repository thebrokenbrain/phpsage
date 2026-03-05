<?php

declare(strict_types=1);

namespace Example\Infrastructure\Mail;

use Example\Application\Port\Mailer;

// This adapter intentionally includes minor defects to enrich static-analysis output.
final class ArrayMailer implements Mailer
{
    /**
     * @var list<string>
     */
    private array $sent = [];

    public function sendWelcome(string $email, string $name): bool
    {
        $this->sent[] = sprintf('welcome:%s:%s', $email, $name);
        $this->totalSent += 1;

        return count($this->sent);
    }
}
