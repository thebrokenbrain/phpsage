<?php

declare(strict_types=1);

namespace Example\Application\Dto;

// This DTO carries registration input across the application layer.
final class RegisterUserInput
{
    /**
     * @param array<string, mixed> $attributes
     */
    public function __construct(
        public readonly int $id,
        public readonly string $email,
        public readonly array $attributes = []
    ) {
    }
}
