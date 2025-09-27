import * as THREE from 'three';
import { PointerLockControls } from 'three/addons/controls/PointerLockControls.js';

let camera, scene, renderer, controls;

const objects = [];

let raycaster;

let moveForward = false;
let moveBackward = false;
let moveLeft = false;
let moveRight = false;
let canJump = false;

let canDash = true;
const dashCooldown = 1; // seconds
let lastDashTime = 0;

let score = 0;

let prevTime = performance.now();
const velocity = new THREE.Vector3();
const direction = new THREE.Vector3();
const vertex = new THREE.Vector3();
const color = new THREE.Color();

const projectiles = [];
const boxHelpers = [];

init();
animate();

function init() {

    camera = new THREE.PerspectiveCamera( 75, window.innerWidth / window.innerHeight, 1, 1000 );
    camera.position.y = 10;

    scene = new THREE.Scene();
    scene.background = new THREE.Color( 0xffffff );
    scene.fog = new THREE.Fog( 0xffffff, 0, 750 );

    const light = new THREE.HemisphereLight( 0xeeeeff, 0x777788, 2.5 );
    light.position.set( 0.5, 1, 0.75 );
    scene.add( light );

    controls = new PointerLockControls( camera, document.body );

    const blocker = document.createElement('div');
    blocker.id = 'blocker';
    blocker.style.position = 'absolute';
    blocker.style.width = '100%';
    blocker.style.height = '100%';
    blocker.style.backgroundColor = 'rgba(0,0,0,0.5)';
    
    const instructions = document.createElement('div');
    instructions.id = 'instructions';
    instructions.style.width = '100%';
    instructions.style.height = '100%';
    instructions.style.display = 'flex';
    instructions.style.flexDirection = 'column';
    instructions.style.justifyContent = 'center';
    instructions.style.alignItems = 'center';
    instructions.style.textAlign = 'center';
    instructions.style.fontSize = '24px';
    instructions.style.color = 'white';
    instructions.style.cursor = 'pointer';
    instructions.innerHTML = `
        <p>Click to play</p>
        <p>
            Move: WASD<br/>
            Jump: SPACE<br/>
            Look: MOUSE
        </p>
    `;

    blocker.appendChild(instructions);
    document.body.appendChild(blocker);


    instructions.addEventListener( 'click', function () {

        controls.lock();

    } );

    controls.addEventListener( 'lock', function () {

        instructions.style.display = 'none';
        blocker.style.display = 'none';

    } );

    controls.addEventListener( 'unlock', function () {

        blocker.style.display = 'block';
        instructions.style.display = '';

    } );

    scene.add( controls.getObject() );

    const onMouseDown = function ( event ) {
        if (controls.isLocked) {
            shoot();
        }
    }

    const onKeyDown = function ( event ) {

        switch ( event.code ) {

            case 'ArrowUp':
            case 'KeyW':
                moveForward = true;
                break;

            case 'ArrowLeft':
            case 'KeyA':
                moveLeft = true;
                break;

            case 'ArrowDown':
            case 'KeyS':
                moveBackward = true;
                break;

            case 'ArrowRight':
            case 'KeyD':
                moveRight = true;
                break;

            case 'Space':
                if ( canJump === true ) velocity.y += 350;
                canJump = false;
                break;
            
            case 'ShiftLeft':
                if (canDash) {
                    dash();
                }
                break;

        }

    };

    const onKeyUp = function ( event ) {

        switch ( event.code ) {

            case 'ArrowUp':
            case 'KeyW':
                moveForward = false;
                break;

            case 'ArrowLeft':
            case 'KeyA':
                moveLeft = false;
                break;

            case 'ArrowDown':
            case 'KeyS':
                moveBackward = false;
                break;

            case 'ArrowRight':
            case 'KeyD':
                moveRight = false;
                break;

        }

    };



    document.addEventListener( 'keydown', onKeyDown );
    document.addEventListener( 'keyup', onKeyUp );
    document.addEventListener( 'mousedown', onMouseDown);

    raycaster = new THREE.Raycaster( new THREE.Vector3(), new THREE.Vector3( 0, - 1, 0 ), 0, 10 );

    // floor

    let floorGeometry = new THREE.PlaneGeometry( 2000, 2000, 100, 100 );
    floorGeometry.rotateX( - Math.PI / 2 );

    const position = floorGeometry.attributes.position;

    for ( let i = 0, l = position.count; i < l; i ++ ) {

        vertex.fromBufferAttribute( position, i );

        vertex.x += Math.random() * 20 - 10;
        vertex.y += Math.random() * 2;
        vertex.z += Math.random() * 20 - 10;

        position.setXYZ( i, vertex.x, vertex.y, vertex.z );

    }

    floorGeometry = floorGeometry.toNonIndexed(); // ensure each face has unique vertices

    const floorMaterial = new THREE.MeshBasicMaterial( { vertexColors: true } );

    const floor = new THREE.Mesh( floorGeometry, floorMaterial );
    scene.add( floor );
    
    // objects

    for ( let i = 0; i < 100; i ++ ) {
        createEnemy();
    }


    //

    renderer = new THREE.WebGLRenderer( { antialias: true } );
    renderer.setPixelRatio( window.devicePixelRatio );
    renderer.setSize( window.innerWidth, window.innerHeight );
    document.body.appendChild( renderer.domElement );

    //

    window.addEventListener( 'resize', onWindowResize );

}

function onWindowResize() {

    camera.aspect = window.innerWidth / window.innerHeight;
    camera.updateProjectionMatrix();

    renderer.setSize( window.innerWidth, window.innerHeight );

}

function createEnemy() {
    const enemy = new THREE.Group();

    // Body
    const bodyGeometry = new THREE.CylinderGeometry(5, 5, 20, 8);
    const bodyMaterial = new THREE.MeshBasicMaterial({ color: 0x0000ff });
    const body = new THREE.Mesh(bodyGeometry, bodyMaterial);
    body.position.y = 10;
    enemy.add(body);

    // Head
    const headGeometry = new THREE.SphereGeometry(5, 8, 8);
    const headMaterial = new THREE.MeshBasicMaterial({ color: 0xffd2a6 });
    const head = new THREE.Mesh(headGeometry, headMaterial);
    head.position.y = 25;
    enemy.add(head);

    // Hat
    const hatGeometry = new THREE.CylinderGeometry(7, 7, 2, 8);
    const hatMaterial = new THREE.MeshBasicMaterial({ color: 0x555555 });
    const hat = new THREE.Mesh(hatGeometry, hatMaterial);
    hat.position.y = 29;
    enemy.add(hat);
    
    const hatBrimGeometry = new THREE.CylinderGeometry(9, 9, 1, 8);
    const hatBrim = new THREE.Mesh(hatBrimGeometry, hatMaterial);
    hatBrim.position.y = 28;
    enemy.add(hatBrim);


    enemy.position.x = Math.floor( Math.random() * 20 - 10 ) * 20;
    enemy.position.y = 0;
    enemy.position.z = Math.floor( Math.random() * 20 - 10 ) * 20;

    enemy.velocity = new THREE.Vector3(
        (Math.random() - 0.5) * 50,
        0,
        (Math.random() - 0.5) * 50
    );

    scene.add( enemy );
    objects.push( enemy );

    const boxHelper = new THREE.BoxHelper(enemy, 0xff0000);
    boxHelper.visible = false;
    scene.add(boxHelper);
    boxHelpers.push(boxHelper);
}

function dash() {
    canDash = false;
    lastDashTime = performance.now();
    
    const dashSpeed = 400;
    
    // Calculate dash direction based on current movement keys
    const dashDirection = new THREE.Vector3();
    dashDirection.z = Number( moveForward ) - Number( moveBackward );
    dashDirection.x = Number( moveRight ) - Number( moveLeft );
    
    if (dashDirection.lengthSq() === 0) {
        // If no movement keys are pressed, dash forward
        camera.getWorldDirection(dashDirection);
        dashDirection.y = 0; // Don't dash up/down
    }
    
    dashDirection.normalize();

    velocity.z += dashDirection.z * dashSpeed;
    velocity.x += dashDirection.x * dashSpeed;
}

function shoot() {
    const projectileGeometry = new THREE.SphereGeometry(0.5, 8, 8);
    const projectileMaterial = new THREE.MeshBasicMaterial({ color: 0xff0000 });
    const projectile = new THREE.Mesh(projectileGeometry, projectileMaterial);

    projectile.position.copy(camera.position);
    
    const direction = new THREE.Vector3();
    camera.getWorldDirection(direction);
    projectile.velocity = direction.multiplyScalar(500);

    projectiles.push(projectile);
    scene.add(projectile);
}

function animate() {

    requestAnimationFrame( animate );

    const time = performance.now();
    const delta = ( time - prevTime ) / 1000;

    // Cooldowns
    if (!canDash) {
        if ((time - lastDashTime) / 1000 > dashCooldown) {
            canDash = true;
            document.getElementById('crosshair').style.borderColor = 'white';
        } else {
            document.getElementById('crosshair').style.borderColor = 'red';
        }
    }

    if ( controls.isLocked === true ) {

        raycaster.ray.origin.copy( controls.getObject().position );
        raycaster.ray.origin.y -= 10;

        const intersections = raycaster.intersectObjects( objects, false );

        const onObject = intersections.length > 0;

        velocity.x -= velocity.x * 10.0 * delta;
        velocity.z -= velocity.z * 10.0 * delta;

        velocity.y -= 9.8 * 100.0 * delta; // 100.0 = mass

        direction.z = Number( moveForward ) - Number( moveBackward );
        direction.x = Number( moveRight ) - Number( moveLeft );
        direction.normalize(); // this ensures consistent movements in all directions

        if ( moveForward || moveBackward ) velocity.z -= direction.z * 400.0 * delta;
        if ( moveLeft || moveRight ) velocity.x -= direction.x * 400.0 * delta;

        if ( onObject === true ) {

            velocity.y = Math.max( 0, velocity.y );
            canJump = true;

        }

        controls.moveRight( - velocity.x * delta );
        controls.moveForward( - velocity.z * delta );

        controls.getObject().position.y += ( velocity.y * delta ); // new behavior

        if ( controls.getObject().position.y < 10 ) {

            velocity.y = 0;
            controls.getObject().position.y = 10;

            canJump = true;

        }

    }

    // Update projectiles
    for (let i = projectiles.length - 1; i >= 0; i--) {
        const projectile = projectiles[i];
        projectile.position.add(projectile.velocity.clone().multiplyScalar(delta));

        // Remove projectile if it's too far
        if (projectile.position.length() > 1000) {
            scene.remove(projectile);
            projectiles.splice(i, 1);
            continue;
        }

        // Collision detection
        for (let j = objects.length - 1; j >= 0; j--) {
            const box = objects[j];
            if (projectile.position.distanceTo(box.position) < 30) { 
                scene.remove(projectile);
                projectiles.splice(i, 1);
                
                scene.remove(box);
                objects.splice(j, 1);
                boxHelpers.splice(j, 1);

                score++;
                document.getElementById('score').innerText = 'Score: ' + score;

                break; 
            }
        }
    }

    // Update enemies
    const playAreaSize = 1000;
    for (let i = 0; i < objects.length; i++) {
        const box = objects[i];
        box.position.add(box.velocity.clone().multiplyScalar(delta));

        // Bounce off walls
        if (box.position.x > playAreaSize || box.position.x < -playAreaSize) {
            box.velocity.x *= -1;
        }
        if (box.position.z > playAreaSize || box.position.z < -playAreaSize) {
            box.velocity.z *= -1;
        }

        boxHelpers[i].update();
    }


    prevTime = time;

    renderer.render( scene, camera );

}
