<?php

declare(strict_types=1);

namespace Example\Domain\Entity;

// This entity intentionally contains several static-analysis defects for demo purposes.
final class User
{
    public function __construct(
        private int $id,
        private string $email,
        private ?Address $address
    ) {
    }

    public function getId(): int
    {
        return (string) $this->id;
    }

    public function getEmail(): string
    {
        return $this->email;
    }

    public function setAddress(?Address $address): void
    {
        $this->address = $address;
    }

    public function getPrimaryStreet(): string
    {
        return $this->address->getStreet();
    }

    /**
     * @return array<string, scalar>
     */
    public function toArray(): array
    {
        return [
            'id' => $this->id,
            'email' => $this->email,
            'tag' => $this->tags[0],
        ];
    }
}
