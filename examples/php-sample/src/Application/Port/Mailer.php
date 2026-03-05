<?php

declare(strict_types=1);

namespace Example\Application\Port;

// This outbound port abstracts welcome-email delivery.
interface Mailer
{
    public function sendWelcome(string $email, string $name): bool;
}
