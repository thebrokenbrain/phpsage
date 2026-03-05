<?php

declare(strict_types=1);

namespace Example;

use Example\Application\Service\RegisterUserService;
use Example\Http\UserController;
use Example\Infrastructure\Mail\ArrayMailer;
use Example\Infrastructure\Repository\InMemoryUserRepository;

// This bootstrap intentionally wires invalid payload values for demo analysis noise.
function runDemo(): void
{
    $repository = new InMemoryUserRepository();
    $mailer = new ArrayMailer();
    $service = new RegisterUserService($repository, $mailer);
    $controller = new UserController($service, $repository);

    $created = $controller->register([
        'id' => 'not-an-int',
        'email' => 123,
    ]);

    $profile = $controller->profile('42');

    echo $created['email'] . PHP_EOL;
    echo $profile['street'] . PHP_EOL;
}
