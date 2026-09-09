plugins {
    id("application")
}

application {
    mainClass.set("com.acme.app.Main")
}

dependencies {
    implementation(project(":lib"))
}

test {
    useJUnitPlatform()
}
